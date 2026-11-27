package com.datcommerce.api.experience;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SeasonalExperienceResolverService {

    private final SeasonalExperienceRepository experienceRepository;
    private final SeasonalExperienceVersionRepository versionRepository;
    private final SeasonalExperienceSettingsRepository settingsRepository;

    public SeasonalExperienceResolverService(
            SeasonalExperienceRepository experienceRepository,
            SeasonalExperienceVersionRepository versionRepository,
            SeasonalExperienceSettingsRepository settingsRepository
    ) {
        this.experienceRepository = experienceRepository;
        this.versionRepository = versionRepository;
        this.settingsRepository = settingsRepository;
    }

    @Transactional(readOnly = true)
    public SeasonalExperienceDtos.ResolvedStorefrontExperienceDto resolveForStore(
            UUID storeId,
            Instant at,
            String routeFilter
    ) {
        Instant evalTime = at != null ? at : Instant.now();
        SeasonalExperienceSettingsEntity settings = settingsRepository.findById(storeId)
                .orElseGet(() -> defaultSettings(storeId));

        if (!settings.isEnabled()) {
            return new SeasonalExperienceDtos.ResolvedStorefrontExperienceDto(
                    false,
                    evalTime,
                    null,
                    settings.getMobilePerformanceMode(),
                    settings.isRespectReducedMotion(),
                    settings.isAllowCustomerDismiss(),
                    settings.getGlobalParticleCap(),
                    List.of(),
                    Map.of("enabled", false),
                    List.of(),
                    List.of("Storefront seasonal experiences are globally disabled.")
            );
        }

        List<SeasonalExperienceEntity> all = experienceRepository.findAllByStoreIdOrderByPriorityDescUpdatedAtDesc(storeId);
        Instant nextTransitionAt = computeNextTransitionAt(all, evalTime);

        List<SeasonalExperienceEntity> candidates = new ArrayList<>();
        for (SeasonalExperienceEntity exp : all) {
            if ("ARCHIVED".equalsIgnoreCase(exp.getStatus())
                    || "DRAFT".equalsIgnoreCase(exp.getStatus())
                    || "PAUSED".equalsIgnoreCase(exp.getStatus())
                    || "ENDED".equalsIgnoreCase(exp.getStatus())) {
                continue;
            }
            if (isCandidateActiveAt(exp, evalTime)) {
                if (!StringUtils.hasText(routeFilter) || matchesAnyTargetPage(routeFilter, exp.getTargetPagesJson())) {
                    candidates.add(exp);
                }
            }
        }

        List<String> trace = new ArrayList<>();
        if (candidates.isEmpty()
                && "KEEP_SEASONAL_BASE".equalsIgnoreCase(settings.getFallbackBehavior())
                && settings.getDefaultExperienceId() != null) {
            all.stream()
                    .filter(e -> e.getId().equals(settings.getDefaultExperienceId())
                            && !"ARCHIVED".equalsIgnoreCase(e.getStatus()))
                    .findFirst()
                    .ifPresent(fallback -> {
                        candidates.add(fallback);
                        trace.add("No primary experience active; using fallback experience '" + fallback.getName() + "'.");
                    });
        }

        if (candidates.isEmpty()) {
            trace.add("No seasonal or event experiences active at " + evalTime + ".");
            return new SeasonalExperienceDtos.ResolvedStorefrontExperienceDto(
                    true,
                    evalTime,
                    nextTransitionAt,
                    settings.getMobilePerformanceMode(),
                    settings.isRespectReducedMotion(),
                    settings.isAllowCustomerDismiss(),
                    settings.getGlobalParticleCap(),
                    List.of(),
                    Map.of("enabled", false),
                    List.of(),
                    trace
            );
        }

        Comparator<SeasonalExperienceEntity> cmp = buildComparator(settings.getConflictStrategy());
        candidates.sort(cmp);

        int maxConcurrent = "SINGLE_HIGHEST_PRIORITY".equalsIgnoreCase(settings.getConflictStrategy())
                ? 1
                : Math.max(1, settings.getMaxConcurrentExperiences());

        Set<String> claimedGroups = new LinkedHashSet<>();
        Map<String, Object> effectiveThemeOverride = Map.of("enabled", false);
        List<SeasonalExperienceDtos.ActiveExperienceSummaryDto> activeSummaries = new ArrayList<>();
        List<SeasonalExperienceDtos.ResolvedExperienceLayerDto> mergedLayers = new ArrayList<>();
        boolean blockedByExclusive = false;

        Map<UUID, SeasonalExperienceVersionEntity> versionCache = new HashMap<>();

        for (SeasonalExperienceEntity exp : candidates) {
            if (blockedByExclusive) {
                trace.add("Skipped '" + exp.getName() + "' (priority " + exp.getPriority() + "): blocked by higher-priority EXCLUSIVE experience.");
                continue;
            }
            if (activeSummaries.size() >= maxConcurrent) {
                trace.add("Skipped '" + exp.getName() + "': maxConcurrentExperiences=" + maxConcurrent + " reached.");
                continue;
            }

            SeasonalExperienceVersionEntity version = resolveVersion(exp, versionCache);
            if (version == null || version.getConfigJson() == null) {
                trace.add("Skipped '" + exp.getName() + "': no saved version found.");
                continue;
            }

            Map<String, Object> cfg = version.getConfigJson();
            String blendMode = exp.getBlendMode() != null ? exp.getBlendMode().toUpperCase(Locale.ROOT) : "OVERRIDE";
            List<String> declaredGroups = exp.getExclusiveGroupsJson() != null ? exp.getExclusiveGroupsJson() : List.of();

            if (!activeSummaries.isEmpty() && "EXCLUSIVE".equals(blendMode)) {
                trace.add("Skipped '" + exp.getName() + "': blendMode=EXCLUSIVE cannot layer under an active higher-priority experience.");
                continue;
            }

            // Check declared exclusive group collision with already-claimed groups when OVERRIDE
            if (!activeSummaries.isEmpty() && "OVERRIDE".equals(blendMode)) {
                boolean collidesAll = !declaredGroups.isEmpty() && declaredGroups.stream().allMatch(claimedGroups::contains);
                if (collidesAll) {
                    trace.add("Skipped '" + exp.getName() + "': all exclusive groups " + declaredGroups + " already claimed.");
                    continue;
                }
            }

            boolean contributed = false;

            // Theme override contribution
            if (!claimedGroups.contains("theme_palette") && cfg.get("themeOverride") instanceof Map<?, ?> themeMap) {
                if (Boolean.TRUE.equals(themeMap.get("enabled"))) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> castTheme = new LinkedHashMap<>((Map<String, Object>) themeMap);
                    effectiveThemeOverride = castTheme;
                    claimedGroups.add("theme_palette");
                    contributed = true;
                    trace.add("Applied themeOverride from '" + exp.getName() + "' (priority " + exp.getPriority() + ", blendMode=" + blendMode + ").");
                }
            }

            // Visual layers contribution (unless THEME_ONLY)
            if (!"THEME_ONLY".equals(blendMode)) {
                List<Map<String, Object>> layers = extractLayers(cfg);
                int addedLayers = 0;
                for (Map<String, Object> rawLayer : layers) {
                    if (!Boolean.TRUE.equals(rawLayer.get("enabled"))) continue;
                    String type = str(rawLayer.get("type"));
                    String naturalGroup = SeasonalExperienceValidator.conflictGroupForLayerType(type);
                    if (!activeSummaries.isEmpty() && claimedGroups.contains(naturalGroup)) {
                        trace.add("Suppressed layer '" + rawLayer.get("label") + "' (" + type + ") from '" + exp.getName() + "' due to claimed group '" + naturalGroup + "'.");
                        continue;
                    }
                    mergedLayers.add(toResolvedLayer(exp, rawLayer));
                    addedLayers++;
                    if (!"STACK".equals(blendMode)) {
                        claimedGroups.add(naturalGroup);
                    }
                }
                if (addedLayers > 0) {
                    contributed = true;
                    trace.add("Merged " + addedLayers + " layer(s) from '" + exp.getName() + "' (priority " + exp.getPriority() + ", blendMode=" + blendMode + ").");
                }
            } else {
                trace.add("'" + exp.getName() + "' ran in THEME_ONLY mode (visual overlay layers omitted).");
            }

            if (contributed || activeSummaries.isEmpty()) {
                activeSummaries.add(new SeasonalExperienceDtos.ActiveExperienceSummaryDto(
                        exp.getId(),
                        exp.getSlug(),
                        exp.getName(),
                        exp.getCategory(),
                        exp.getPriority(),
                        blendMode,
                        exp.getStartsAt(),
                        exp.getEndsAt(),
                        exp.getTargetPagesJson() != null ? exp.getTargetPagesJson() : List.of("*")
                ));
                claimedGroups.addAll(declaredGroups);
            }

            if ("EXCLUSIVE".equals(blendMode)) {
                blockedByExclusive = true;
                trace.add("'" + exp.getName() + "' is EXCLUSIVE; lower-priority experiences are blocked.");
            }
        }

        // Enforce globalParticleCap proportionally across particle layers
        int globalCap = Math.max(10, settings.getGlobalParticleCap());
        int totalParticleDensity = 0;
        for (SeasonalExperienceDtos.ResolvedExperienceLayerDto l : mergedLayers) {
            if (SeasonalExperienceValidator.PARTICLE_TYPES.contains(l.type())) {
                Object d = l.props().get("density");
                totalParticleDensity += d instanceof Number n ? n.intValue() : 50;
            }
        }

        List<SeasonalExperienceDtos.ResolvedExperienceLayerDto> finalLayers;
        if (totalParticleDensity > globalCap && totalParticleDensity > 0) {
            double scale = (double) globalCap / (double) totalParticleDensity;
            trace.add(String.format(Locale.ROOT,
                    "Scaled particle densities by %.2fx to respect globalParticleCap=%d (raw total=%d).",
                    scale, globalCap, totalParticleDensity));
            finalLayers = mergedLayers.stream()
                    .map(l -> SeasonalExperienceValidator.PARTICLE_TYPES.contains(l.type())
                            ? new SeasonalExperienceDtos.ResolvedExperienceLayerDto(
                                    l.sourceExperienceId(), l.sourceExperienceName(), l.id(), l.type(), l.label(),
                                    l.zone(), l.zIndex(), l.opacity(), l.blendMode(), l.visibility(), l.trigger(),
                                    Math.max(0.2, Math.round(scale * 100.0) / 100.0),
                                    l.experienceEndsAt(), l.targetPages(), l.props())
                            : l)
                    .sorted(Comparator.comparingInt(SeasonalExperienceDtos.ResolvedExperienceLayerDto::zIndex))
                    .toList();
        } else {
            finalLayers = mergedLayers.stream()
                    .sorted(Comparator.comparingInt(SeasonalExperienceDtos.ResolvedExperienceLayerDto::zIndex))
                    .toList();
        }

        return new SeasonalExperienceDtos.ResolvedStorefrontExperienceDto(
                true,
                evalTime,
                nextTransitionAt,
                settings.getMobilePerformanceMode(),
                settings.isRespectReducedMotion(),
                settings.isAllowCustomerDismiss(),
                settings.getGlobalParticleCap(),
                activeSummaries,
                effectiveThemeOverride,
                finalLayers,
                trace
        );
    }

    public static SeasonalExperienceSettingsEntity defaultSettings(UUID storeId) {
        SeasonalExperienceSettingsEntity s = new SeasonalExperienceSettingsEntity();
        s.setStoreId(storeId);
        s.setEnabled(true);
        s.setConflictStrategy("PRIORITY_STACK");
        s.setMaxConcurrentExperiences(2);
        s.setGlobalParticleCap(160);
        s.setMobilePerformanceMode("ADAPTIVE");
        s.setRespectReducedMotion(true);
        s.setFallbackBehavior("REVERT_DEFAULT_THEME");
        s.setDefaultExperienceId(null);
        s.setAllowCustomerDismiss(true);
        s.setUpdatedAt(Instant.now());
        return s;
    }

    private boolean isCandidateActiveAt(SeasonalExperienceEntity exp, Instant at) {
        if ("MANUAL".equalsIgnoreCase(exp.getActivationMode()) || exp.isManualOverride()) {
            if (!"ACTIVE".equalsIgnoreCase(exp.getStatus())) {
                return false;
            }
            if (!exp.isManualOverride() && exp.getEndsAt() != null && !exp.getEndsAt().isAfter(at)) {
                return false;
            }
            return true;
        }
        if ("SCHEDULED".equalsIgnoreCase(exp.getActivationMode())) {
            boolean statusEligible = "SCHEDULED".equalsIgnoreCase(exp.getStatus())
                    || "ACTIVE".equalsIgnoreCase(exp.getStatus());
            if (!statusEligible) return false;
            if (exp.getStartsAt() != null && exp.getStartsAt().isAfter(at)) return false;
            if (exp.getEndsAt() != null && !exp.getEndsAt().isAfter(at)) return false;
            return true;
        }
        return false;
    }

    private Instant computeNextTransitionAt(List<SeasonalExperienceEntity> all, Instant at) {
        Instant earliest = null;
        for (SeasonalExperienceEntity exp : all) {
            if ("ARCHIVED".equalsIgnoreCase(exp.getStatus())
                    || "DRAFT".equalsIgnoreCase(exp.getStatus())
                    || "PAUSED".equalsIgnoreCase(exp.getStatus())
                    || "ENDED".equalsIgnoreCase(exp.getStatus())) {
                continue;
            }
            if ("SCHEDULED".equalsIgnoreCase(exp.getActivationMode()) && !exp.isManualOverride()) {
                if (exp.getStartsAt() != null && exp.getStartsAt().isAfter(at)) {
                    earliest = earliest == null || exp.getStartsAt().isBefore(earliest) ? exp.getStartsAt() : earliest;
                }
                if (exp.getEndsAt() != null && exp.getEndsAt().isAfter(at)) {
                    earliest = earliest == null || exp.getEndsAt().isBefore(earliest) ? exp.getEndsAt() : earliest;
                }
            }
        }
        return earliest;
    }

    private Comparator<SeasonalExperienceEntity> buildComparator(String conflictStrategy) {
        if ("MANUAL_WINS_OVER_SCHEDULED".equalsIgnoreCase(conflictStrategy)) {
            return Comparator
                    .comparing((SeasonalExperienceEntity e) ->
                            ("MANUAL".equalsIgnoreCase(e.getActivationMode()) || e.isManualOverride()) ? 0 : 1)
                    .thenComparing(Comparator.comparingInt(SeasonalExperienceEntity::getPriority).reversed())
                    .thenComparing(Comparator.comparing(SeasonalExperienceEntity::getUpdatedAt).reversed());
        }
        return Comparator
                .comparingInt(SeasonalExperienceEntity::getPriority).reversed()
                .thenComparing(SeasonalExperienceEntity::getUpdatedAt, Comparator.reverseOrder());
    }

    private SeasonalExperienceVersionEntity resolveVersion(
            SeasonalExperienceEntity exp,
            Map<UUID, SeasonalExperienceVersionEntity> cache
    ) {
        if (exp.getActiveVersionId() != null) {
            return cache.computeIfAbsent(exp.getActiveVersionId(),
                    id -> versionRepository.findByIdAndExperienceId(id, exp.getId()).orElse(null));
        }
        return versionRepository.findTopByExperienceIdOrderByVersionNumberDesc(exp.getId()).orElse(null);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractLayers(Map<String, Object> config) {
        Object raw = config.get("layers");
        if (!(raw instanceof List<?> list)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> m) {
                out.add((Map<String, Object>) m);
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private SeasonalExperienceDtos.ResolvedExperienceLayerDto toResolvedLayer(
            SeasonalExperienceEntity exp,
            Map<String, Object> raw
    ) {
        Map<String, Object> visibility = raw.get("visibility") instanceof Map<?, ?> vm
                ? new LinkedHashMap<>((Map<String, Object>) vm)
                : Map.of("desktop", true, "tablet", true, "mobile", true);
        Map<String, Object> props = raw.get("props") instanceof Map<?, ?> pm
                ? new LinkedHashMap<>((Map<String, Object>) pm)
                : Map.of();

        return new SeasonalExperienceDtos.ResolvedExperienceLayerDto(
                exp.getId(),
                exp.getName(),
                str(raw.get("id")),
                str(raw.get("type")),
                str(raw.get("label")),
                str(raw.get("zone")),
                raw.get("zIndex") instanceof Number n ? n.intValue() : 20,
                raw.get("opacity") instanceof Number n ? n.doubleValue() : 1.0,
                str(raw.get("blendMode")).isEmpty() ? "normal" : str(raw.get("blendMode")),
                visibility,
                str(raw.get("trigger")).isEmpty() ? "immediate" : str(raw.get("trigger")),
                1.0,
                exp.getEndsAt(),
                exp.getTargetPagesJson() != null ? exp.getTargetPagesJson() : List.of("*"),
                props
        );
    }

    public static boolean matchesAnyTargetPage(String route, List<String> patterns) {
        if (patterns == null || patterns.isEmpty()) return true;
        String cleanRoute = route.trim();
        for (String pat : patterns) {
            if (!StringUtils.hasText(pat)) continue;
            String p = pat.trim();
            if ("*".equals(p) || "/*".equals(p)) return true;
            if (p.endsWith("*")) {
                String prefix = p.substring(0, p.length() - 1);
                if (cleanRoute.startsWith(prefix)) return true;
            } else if (p.equalsIgnoreCase(cleanRoute)) {
                return true;
            }
        }
        return false;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
