package com.datcommerce.api.experience;

import com.datcommerce.api.cms.BlockSchemaValidator;
import com.datcommerce.api.cms.ThemeTokenValidator;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class SeasonalExperienceValidator {

    public static final int MAX_LAYERS = 20;

    public static final Set<String> CATEGORIES = Set.of(
            "SEASON", "HOLIDAY", "CULTURAL", "OCCASION", "CAMPAIGN", "FLASH_SALE", "CUSTOM"
    );

    public static final Set<String> STATUSES = Set.of(
            "DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED", "ARCHIVED"
    );

    public static final Set<String> ACTIVATION_MODES = Set.of("MANUAL", "SCHEDULED");

    public static final Set<String> RECURRENCE_RULES = Set.of("NONE", "YEARLY", "MONTHLY");

    public static final Set<String> BLEND_MODES = Set.of("EXCLUSIVE", "OVERRIDE", "STACK", "THEME_ONLY");

    public static final Set<String> EXCLUSIVE_GROUPS = Set.of(
            "weather_particles",
            "theme_palette",
            "top_banner",
            "header_decor",
            "corner_decor",
            "promo_highlight",
            "ambient_backdrop",
            "floating_widget"
    );

    public static final Set<String> ZONES = Set.of(
            "viewport_overlay",
            "top_announcement",
            "header_frame",
            "hero_stage",
            "floating_corner",
            "footer_stage"
    );

    public static final Set<String> LAYER_TYPES = Set.of(
            "snowfall",
            "blossom_petals",
            "floating_hearts",
            "golden_particles",
            "fireworks",
            "confetti_burst",
            "santa_sleigh",
            "string_lights",
            "festive_lanterns",
            "corner_floral_frame",
            "promo_banner",
            "countdown_bar",
            "ambient_glow",
            "floating_sticker"
    );

    public static final Set<String> LAYER_BLEND_MODES = Set.of("normal", "screen", "lighter");

    public static final Set<String> PARTICLE_TYPES = Set.of(
            "snowfall", "blossom_petals", "floating_hearts", "golden_particles", "confetti_burst"
    );

    public static final Set<String> CONFLICT_STRATEGIES = Set.of(
            "SINGLE_HIGHEST_PRIORITY", "PRIORITY_STACK", "MANUAL_WINS_OVER_SCHEDULED"
    );

    public static final Set<String> MOBILE_MODES = Set.of("FULL", "ADAPTIVE", "MINIMAL", "OFF");

    public static final Set<String> FALLBACK_BEHAVIORS = Set.of(
            "REVERT_DEFAULT_THEME", "ACTIVATE_NEXT_SCHEDULED", "KEEP_SEASONAL_BASE"
    );

    private static final Pattern SAFE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final Pattern SAFE_SLUG_PATTERN = Pattern.compile("^[a-z0-9-]{1,100}$");
    private static final Pattern SAFE_TARGET_PAGE_PATTERN = Pattern.compile("^(\\*|/[A-Za-z0-9_/*-]{0,120})$");

    public String normalizeCategory(String raw) {
        if (!StringUtils.hasText(raw)) return "CUSTOM";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!CATEGORIES.contains(upper)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported experience category: " + raw);
        }
        return upper;
    }

    public String normalizeActivationMode(String raw) {
        if (!StringUtils.hasText(raw)) return "MANUAL";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!ACTIVATION_MODES.contains(upper)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported activationMode: " + raw);
        }
        return upper;
    }

    public String normalizeRecurrenceRule(String raw) {
        if (!StringUtils.hasText(raw)) return "NONE";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!RECURRENCE_RULES.contains(upper)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported recurrenceRule: " + raw);
        }
        return upper;
    }

    public String normalizeBlendMode(String raw) {
        if (!StringUtils.hasText(raw)) return "OVERRIDE";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!BLEND_MODES.contains(upper)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported blendMode: " + raw);
        }
        return upper;
    }

    public String normalizeTimezone(String raw) {
        if (!StringUtils.hasText(raw)) return "UTC";
        String tz = raw.trim();
        try {
            ZoneId.of(tz);
            return tz;
        } catch (Exception ex) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid timezone identifier: " + tz);
        }
    }

    public void validateScheduleRange(Instant startsAt, Instant endsAt) {
        if (startsAt != null && endsAt != null && !endsAt.isAfter(startsAt)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "endsAt must be strictly after startsAt");
        }
    }

    public int validatePriority(Integer priority) {
        if (priority == null) return 50;
        if (priority < 0 || priority > 1000) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "priority must be between 0 and 1000");
        }
        return priority;
    }

    public int validateParticleBudget(Integer budget) {
        if (budget == null) return 120;
        if (budget < 10 || budget > 400) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "maxParticleBudget must be between 10 and 400");
        }
        return budget;
    }

    public List<String> normalizeExclusiveGroups(List<String> raw) {
        if (raw == null || raw.isEmpty()) return List.of();
        Set<String> out = new LinkedHashSet<>();
        for (String item : raw) {
            if (!StringUtils.hasText(item)) continue;
            String clean = item.trim().toLowerCase(Locale.ROOT);
            if (!EXCLUSIVE_GROUPS.contains(clean)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported exclusive group: " + item);
            }
            out.add(clean);
        }
        return List.copyOf(out);
    }

    public List<String> normalizeTargetPages(List<String> raw) {
        if (raw == null || raw.isEmpty()) return List.of("*");
        Set<String> out = new LinkedHashSet<>();
        for (String item : raw) {
            if (!StringUtils.hasText(item)) continue;
            String clean = item.trim();
            if (!SAFE_TARGET_PAGE_PATTERN.matcher(clean).matches()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid targetPages pattern: " + clean);
            }
            out.add(clean);
        }
        return out.isEmpty() ? List.of("*") : List.copyOf(out);
    }

    public String normalizeSlug(String rawSlug, String fallbackName) {
        String source = StringUtils.hasText(rawSlug) ? rawSlug : fallbackName;
        if (!StringUtils.hasText(source)) {
            return "experience-" + UUID.randomUUID().toString().substring(0, 8);
        }
        String clean = source.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (clean.isEmpty()) {
            clean = "experience-" + UUID.randomUUID().toString().substring(0, 8);
        }
        if (clean.length() > 100) {
            clean = clean.substring(0, 100).replaceAll("-+$", "");
        }
        if (!SAFE_SLUG_PATTERN.matcher(clean).matches()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid experience slug: " + clean);
        }
        return clean;
    }

    public String normalizeConflictStrategy(String raw) {
        if (!StringUtils.hasText(raw)) return "PRIORITY_STACK";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!CONFLICT_STRATEGIES.contains(upper)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported conflictStrategy: " + raw);
        }
        return upper;
    }

    public String normalizeMobilePerformanceMode(String raw) {
        if (!StringUtils.hasText(raw)) return "ADAPTIVE";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!MOBILE_MODES.contains(upper)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported mobilePerformanceMode: " + raw);
        }
        return upper;
    }

    public String normalizeFallbackBehavior(String raw) {
        if (!StringUtils.hasText(raw)) return "REVERT_DEFAULT_THEME";
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!FALLBACK_BEHAVIORS.contains(upper)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported fallbackBehavior: " + raw);
        }
        return upper;
    }

    public Map<String, Object> validateAndNormalizeConfig(Map<String, Object> rawConfig) {
        if (rawConfig == null) {
            return defaultEmptyConfig();
        }
        BlockSchemaValidator.assertSafeRecursive(rawConfig, "experience.config");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemaVersion", 1);

        Object themeObj = rawConfig.get("themeOverride");
        out.put("themeOverride", validateThemeOverride(themeObj));

        Object motionObj = rawConfig.get("motion");
        out.put("motion", validateMotion(motionObj));

        Object layersObj = rawConfig.get("layers");
        List<Map<String, Object>> normalizedLayers = new ArrayList<>();
        if (layersObj != null) {
            if (!(layersObj instanceof List<?> rawList)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "config.layers must be an array");
            }
            if (rawList.size() > MAX_LAYERS) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "An experience can contain at most " + MAX_LAYERS + " layers");
            }
            Set<String> seenIds = new LinkedHashSet<>();
            for (int i = 0; i < rawList.size(); i++) {
                Object item = rawList.get(i);
                if (!(item instanceof Map<?, ?> rawLayer)) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "config.layers[" + i + "] must be an object");
                }
                Map<String, Object> cleanLayer = validateLayer(rawLayer, i);
                String id = String.valueOf(cleanLayer.get("id"));
                if (!seenIds.add(id)) {
                    id = id + "-" + i;
                    cleanLayer.put("id", id);
                    seenIds.add(id);
                }
                normalizedLayers.add(cleanLayer);
            }
        }
        out.put("layers", normalizedLayers);
        return out;
    }

    public static Map<String, Object> defaultEmptyConfig() {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("schemaVersion", 1);
        cfg.put("themeOverride", Map.of("enabled", false, "mode", "accent_tint"));
        cfg.put("motion", Map.of("respectReducedMotion", true, "mobileDensityRatio", 0.5, "pauseOnHiddenTab", true));
        cfg.put("layers", List.of());
        return cfg;
    }

    private Map<String, Object> validateThemeOverride(Object rawObj) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!(rawObj instanceof Map<?, ?> raw)) {
            out.put("enabled", false);
            out.put("mode", "accent_tint");
            return out;
        }
        boolean enabled = Boolean.TRUE.equals(raw.get("enabled"));
        String mode = strOrDefault(raw.get("mode"), "accent_tint").toLowerCase(Locale.ROOT);
        if (!Set.of("accent_tint", "full_palette", "dark_luxe").contains(mode)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid themeOverride.mode: " + mode);
        }
        out.put("enabled", enabled);
        out.put("mode", mode);

        if (raw.get("colors") instanceof Map<?, ?> rawColors) {
            Map<String, Object> colors = new LinkedHashMap<>();
            for (String key : Set.of("primary", "secondary", "accent", "background", "surface", "text", "muted", "border")) {
                if (rawColors.get(key) != null && StringUtils.hasText(String.valueOf(rawColors.get(key)))) {
                    colors.put(key, validateHex(String.valueOf(rawColors.get(key)), "themeOverride.colors." + key));
                }
            }
            if (!colors.isEmpty()) out.put("colors", colors);
        }

        if (raw.get("surfaceTint") != null && StringUtils.hasText(String.valueOf(raw.get("surfaceTint")))) {
            out.put("surfaceTint", validateHex(String.valueOf(raw.get("surfaceTint")), "themeOverride.surfaceTint"));
        }

        if (raw.get("backdrop") instanceof Map<?, ?> rawBackdrop) {
            Map<String, Object> backdrop = new LinkedHashMap<>();
            String kind = strOrDefault(rawBackdrop.get("kind"), "none").toLowerCase(Locale.ROOT);
            if (!Set.of("none", "radial_glow", "top_aurora", "vignette").contains(kind)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid themeOverride.backdrop.kind: " + kind);
            }
            backdrop.put("kind", kind);
            if (rawBackdrop.get("primaryColor") != null && StringUtils.hasText(String.valueOf(rawBackdrop.get("primaryColor")))) {
                backdrop.put("primaryColor", validateHex(String.valueOf(rawBackdrop.get("primaryColor")), "backdrop.primaryColor"));
            }
            if (rawBackdrop.get("secondaryColor") != null && StringUtils.hasText(String.valueOf(rawBackdrop.get("secondaryColor")))) {
                backdrop.put("secondaryColor", validateHex(String.valueOf(rawBackdrop.get("secondaryColor")), "backdrop.secondaryColor"));
            }
            backdrop.put("opacity", clampDouble(rawBackdrop.get("opacity"), 0.0, 0.85, 0.25));
            out.put("backdrop", backdrop);
        }

        if (raw.get("headerOverride") instanceof Map<?, ?> rawHeader) {
            Map<String, Object> header = new LinkedHashMap<>();
            if (rawHeader.get("bgColor") != null && StringUtils.hasText(String.valueOf(rawHeader.get("bgColor")))) {
                header.put("bgColor", validateHex(String.valueOf(rawHeader.get("bgColor")), "headerOverride.bgColor"));
            }
            if (rawHeader.get("textColor") != null && StringUtils.hasText(String.valueOf(rawHeader.get("textColor")))) {
                header.put("textColor", validateHex(String.valueOf(rawHeader.get("textColor")), "headerOverride.textColor"));
            }
            if (rawHeader.get("borderColor") != null && StringUtils.hasText(String.valueOf(rawHeader.get("borderColor")))) {
                header.put("borderColor", validateHex(String.valueOf(rawHeader.get("borderColor")), "headerOverride.borderColor"));
            }
            if (rawHeader.get("announcementBg") != null && StringUtils.hasText(String.valueOf(rawHeader.get("announcementBg")))) {
                header.put("announcementBg", validateHex(String.valueOf(rawHeader.get("announcementBg")), "headerOverride.announcementBg"));
            }
            if (rawHeader.get("announcementTextColor") != null && StringUtils.hasText(String.valueOf(rawHeader.get("announcementTextColor")))) {
                header.put("announcementTextColor", validateHex(String.valueOf(rawHeader.get("announcementTextColor")), "headerOverride.announcementTextColor"));
            }
            if (rawHeader.get("announcementText") != null) {
                header.put("announcementText", clip(String.valueOf(rawHeader.get("announcementText")), 180));
            }
            if (!header.isEmpty()) out.put("headerOverride", header);
        }

        if (raw.get("ctaHighlight") instanceof Map<?, ?> rawCta) {
            Map<String, Object> cta = new LinkedHashMap<>();
            cta.put("enabled", Boolean.TRUE.equals(rawCta.get("enabled")));
            if (rawCta.get("badgeText") != null) {
                cta.put("badgeText", clip(String.valueOf(rawCta.get("badgeText")), 24));
            }
            if (rawCta.get("glowColor") != null && StringUtils.hasText(String.valueOf(rawCta.get("glowColor")))) {
                cta.put("glowColor", validateHex(String.valueOf(rawCta.get("glowColor")), "ctaHighlight.glowColor"));
            }
            cta.put("shimmer", Boolean.TRUE.equals(rawCta.get("shimmer")));
            out.put("ctaHighlight", cta);
        }

        return out;
    }

    private Map<String, Object> validateMotion(Object rawObj) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!(rawObj instanceof Map<?, ?> raw)) {
            out.put("respectReducedMotion", true);
            out.put("mobileDensityRatio", 0.5);
            out.put("pauseOnHiddenTab", true);
            return out;
        }
        out.put("respectReducedMotion", raw.get("respectReducedMotion") == null || Boolean.TRUE.equals(raw.get("respectReducedMotion")));
        out.put("mobileDensityRatio", clampDouble(raw.get("mobileDensityRatio"), 0.0, 1.0, 0.5));
        out.put("pauseOnHiddenTab", raw.get("pauseOnHiddenTab") == null || Boolean.TRUE.equals(raw.get("pauseOnHiddenTab")));
        return out;
    }

    private Map<String, Object> validateLayer(Map<?, ?> rawLayer, int index) {
        String type = strOrDefault(rawLayer.get("type"), "").toLowerCase(Locale.ROOT);
        if (!LAYER_TYPES.contains(type)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported experience layer type: " + type);
        }

        String rawId = strOrDefault(rawLayer.get("id"), "layer-" + (index + 1));
        if (!SAFE_ID_PATTERN.matcher(rawId).matches()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid layer id: " + rawId);
        }

        String label = clip(strOrDefault(rawLayer.get("label"), type), 80);
        if (label.isEmpty()) label = type;

        String zone = strOrDefault(rawLayer.get("zone"), defaultZoneFor(type)).toLowerCase(Locale.ROOT);
        if (!ZONES.contains(zone)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported layer zone '" + zone + "' for layer " + rawId);
        }

        String blendMode = strOrDefault(rawLayer.get("blendMode"), "normal").toLowerCase(Locale.ROOT);
        if (!LAYER_BLEND_MODES.contains(blendMode)) {
            blendMode = "normal";
        }

        Map<String, Object> visibility = new LinkedHashMap<>();
        if (rawLayer.get("visibility") instanceof Map<?, ?> rawVis) {
            visibility.put("desktop", rawVis.get("desktop") == null || Boolean.TRUE.equals(rawVis.get("desktop")));
            visibility.put("tablet", rawVis.get("tablet") == null || Boolean.TRUE.equals(rawVis.get("tablet")));
            visibility.put("mobile", rawVis.get("mobile") == null || Boolean.TRUE.equals(rawVis.get("mobile")));
        } else {
            visibility.put("desktop", true);
            visibility.put("tablet", true);
            visibility.put("mobile", true);
        }

        String trigger = strOrDefault(rawLayer.get("trigger"), "immediate").toLowerCase(Locale.ROOT);
        if (!Set.of("immediate", "on_scroll", "timed_burst").contains(trigger)) {
            trigger = "immediate";
        }

        Map<String, Object> cleanProps = validateLayerProps(
                type,
                rawLayer.get("props") instanceof Map<?, ?> pm ? pm : Map.of()
        );

        Map<String, Object> layer = new LinkedHashMap<>();
        layer.put("id", rawId);
        layer.put("type", type);
        layer.put("label", label);
        layer.put("enabled", rawLayer.get("enabled") == null || Boolean.TRUE.equals(rawLayer.get("enabled")));
        layer.put("locked", Boolean.TRUE.equals(rawLayer.get("locked")));
        layer.put("zone", zone);
        layer.put("zIndex", clampInt(rawLayer.get("zIndex"), 1, 60, 20 + index));
        layer.put("opacity", clampDouble(rawLayer.get("opacity"), 0.05, 1.0, 0.92));
        layer.put("blendMode", blendMode);
        layer.put("visibility", visibility);
        layer.put("trigger", trigger);
        layer.put("props", cleanProps);
        return layer;
    }

    private Map<String, Object> validateLayerProps(String type, Map<?, ?> raw) {
        Map<String, Object> props = new LinkedHashMap<>();
        switch (type) {
            case "snowfall" -> {
                props.put("density", clampInt(raw.get("density"), 10, 200, 75));
                props.put("speed", clampDouble(raw.get("speed"), 0.2, 3.0, 1.0));
                props.put("wind", clampDouble(raw.get("wind"), -2.0, 2.0, 0.35));
                props.put("sizeMin", clampDouble(raw.get("sizeMin"), 1.0, 8.0, 2.0));
                props.put("sizeMax", clampDouble(raw.get("sizeMax"), 2.0, 18.0, 7.0));
                props.put("color", validateHexOrDefault(raw.get("color"), "#FFFFFF"));
                props.put("variant", enumOrDefault(raw.get("variant"), Set.of("soft_bokeh", "crystal_flakes", "mixed"), "mixed"));
            }
            case "blossom_petals" -> {
                props.put("species", enumOrDefault(raw.get("species"), Set.of("cherry_blossom", "apricot_blossom", "peach_blossom", "autumn_leaf", "rose_petal"), "cherry_blossom"));
                props.put("density", clampInt(raw.get("density"), 10, 160, 45));
                props.put("speed", clampDouble(raw.get("speed"), 0.2, 2.5, 0.9));
                props.put("swayAmplitude", clampDouble(raw.get("swayAmplitude"), 0.0, 3.0, 1.2));
                props.put("tumble3d", raw.get("tumble3d") == null || Boolean.TRUE.equals(raw.get("tumble3d")));
                props.put("colors", validateHexList(raw.get("colors"), List.of("#FBCFE8", "#F9A8D4", "#FDF2F8")));
            }
            case "floating_hearts" -> {
                props.put("density", clampInt(raw.get("density"), 8, 120, 32));
                props.put("speed", clampDouble(raw.get("speed"), 0.2, 2.5, 0.85));
                props.put("direction", enumOrDefault(raw.get("direction"), Set.of("rise", "float"), "rise"));
                props.put("glow", raw.get("glow") == null || Boolean.TRUE.equals(raw.get("glow")));
                props.put("colors", validateHexList(raw.get("colors"), List.of("#FB7185", "#F43F5E", "#FDA4AF")));
            }
            case "golden_particles" -> {
                props.put("density", clampInt(raw.get("density"), 10, 180, 65));
                props.put("speed", clampDouble(raw.get("speed"), 0.1, 2.5, 0.7));
                props.put("shape", enumOrDefault(raw.get("shape"), Set.of("sparkle_star", "gold_dust", "diamond"), "sparkle_star"));
                props.put("twinkle", raw.get("twinkle") == null || Boolean.TRUE.equals(raw.get("twinkle")));
                props.put("colors", validateHexList(raw.get("colors"), List.of("#FACC15", "#FDE047", "#D97706")));
            }
            case "fireworks" -> {
                props.put("burstRate", clampDouble(raw.get("burstRate"), 0.2, 2.0, 0.85));
                props.put("particleCount", clampInt(raw.get("particleCount"), 20, 120, 56));
                props.put("gravity", clampDouble(raw.get("gravity"), 0.1, 1.5, 0.45));
                props.put("launchZone", enumOrDefault(raw.get("launchZone"), Set.of("top_sky", "full_viewport"), "top_sky"));
                props.put("trails", raw.get("trails") == null || Boolean.TRUE.equals(raw.get("trails")));
                props.put("colors", validateHexList(raw.get("colors"), List.of("#EF4444", "#FACC15", "#FB923C", "#F472B6")));
            }
            case "confetti_burst" -> {
                props.put("density", clampInt(raw.get("density"), 15, 160, 60));
                props.put("speed", clampDouble(raw.get("speed"), 0.3, 3.0, 1.1));
                props.put("shapes", validateEnumList(raw.get("shapes"), Set.of("ribbon", "circle", "star"), List.of("ribbon", "circle", "star")));
                props.put("colors", validateHexList(raw.get("colors"), List.of("#F43F5E", "#FACC15", "#3B82F6", "#10B981")));
            }
            case "santa_sleigh" -> {
                props.put("flightIntervalSeconds", clampInt(raw.get("flightIntervalSeconds"), 6, 60, 14));
                props.put("flightDurationSeconds", clampInt(raw.get("flightDurationSeconds"), 4, 24, 9));
                props.put("altitudePct", clampInt(raw.get("altitudePct"), 4, 45, 12));
                props.put("direction", enumOrDefault(raw.get("direction"), Set.of("ltr", "rtl"), "ltr"));
                props.put("scale", clampDouble(raw.get("scale"), 0.5, 1.6, 1.0));
                props.put("trailSparkles", raw.get("trailSparkles") == null || Boolean.TRUE.equals(raw.get("trailSparkles")));
                props.put("sleighColor", validateHexOrDefault(raw.get("sleighColor"), "#B91C1C"));
                props.put("glowColor", validateHexOrDefault(raw.get("glowColor"), "#FDE047"));
            }
            case "string_lights" -> {
                props.put("style", enumOrDefault(raw.get("style"), Set.of("christmas_bulbs", "warm_fairy", "icicle_lights", "neon_pulse"), "christmas_bulbs"));
                props.put("bulbCount", clampInt(raw.get("bulbCount"), 8, 48, 22));
                props.put("twinkleSpeed", clampDouble(raw.get("twinkleSpeed"), 0.3, 3.0, 1.1));
                props.put("glowIntensity", clampDouble(raw.get("glowIntensity"), 0.1, 1.0, 0.75));
                props.put("wireColor", validateHexOrDefault(raw.get("wireColor"), "#1E293B"));
                props.put("colors", validateHexList(raw.get("colors"), List.of("#EF4444", "#22C55E", "#FACC15", "#3B82F6")));
            }
            case "festive_lanterns" -> {
                props.put("style", enumOrDefault(raw.get("style"), Set.of("lunar_silk", "gold_palace", "paper_warm"), "lunar_silk"));
                props.put("count", clampInt(raw.get("count"), 2, 12, 6));
                props.put("swayIntensity", clampDouble(raw.get("swayIntensity"), 0.0, 2.0, 1.0));
                props.put("primaryColor", validateHexOrDefault(raw.get("primaryColor"), "#DC2626"));
                props.put("trimColor", validateHexOrDefault(raw.get("trimColor"), "#FACC15"));
                props.put("emblemText", clip(strOrDefault(raw.get("emblemText"), "福"), 4));
            }
            case "corner_floral_frame" -> {
                props.put("motif", enumOrDefault(raw.get("motif"), Set.of("peach_branch", "apricot_branch", "cherry_branch", "pine_holly", "gold_deco", "romantic_floral", "spiderweb_gothic"), "peach_branch"));
                props.put("corners", validateEnumList(raw.get("corners"), Set.of("top-left", "top-right", "bottom-left", "bottom-right"), List.of("top-left", "top-right")));
                props.put("scale", clampDouble(raw.get("scale"), 0.5, 1.6, 1.0));
                props.put("sway", raw.get("sway") == null || Boolean.TRUE.equals(raw.get("sway")));
                props.put("primaryColor", validateHexOrDefault(raw.get("primaryColor"), "#F472B6"));
                props.put("accentColor", validateHexOrDefault(raw.get("accentColor"), "#FACC15"));
            }
            case "promo_banner" -> {
                props.put("badgeText", clip(strOrDefault(raw.get("badgeText"), "LIMITED EVENT"), 32));
                props.put("headline", clip(strOrDefault(raw.get("headline"), "Seasonal Event Is Live"), 140));
                props.put("subtext", clip(strOrDefault(raw.get("subtext"), ""), 180));
                props.put("promoCode", clip(strOrDefault(raw.get("promoCode"), ""), 32));
                props.put("ctaLabel", clip(strOrDefault(raw.get("ctaLabel"), "Shop Now"), 40));
                props.put("ctaUrl", validateSafeLinkOrDefault(raw.get("ctaUrl"), "/store/shop"));
                props.put("bgColor", validateHexOrDefault(raw.get("bgColor"), "#18181B"));
                props.put("textColor", validateHexOrDefault(raw.get("textColor"), "#FFFFFF"));
                props.put("accentColor", validateHexOrDefault(raw.get("accentColor"), "#FACC15"));
                props.put("animationStyle", enumOrDefault(raw.get("animationStyle"), Set.of("shimmer", "pulse_glow", "ticker", "slide_in"), "shimmer"));
                props.put("dismissible", Boolean.TRUE.equals(raw.get("dismissible")));
            }
            case "countdown_bar" -> {
                props.put("title", clip(strOrDefault(raw.get("title"), "Flash Sale Ends In"), 80));
                props.put("syncWithExperienceEnd", raw.get("syncWithExperienceEnd") == null || Boolean.TRUE.equals(raw.get("syncWithExperienceEnd")));
                String targetIso = strOrDefault(raw.get("targetIso"), "");
                if (StringUtils.hasText(targetIso)) {
                    try {
                        Instant.parse(targetIso);
                        props.put("targetIso", targetIso);
                    } catch (Exception ex) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "countdown_bar.targetIso must be valid ISO-8601 timestamp");
                    }
                } else {
                    props.put("targetIso", "");
                }
                props.put("variant", enumOrDefault(raw.get("variant"), Set.of("full_bar", "floating_pill", "hero_ribbon"), "full_bar"));
                props.put("bgColor", validateHexOrDefault(raw.get("bgColor"), "#991B1B"));
                props.put("textColor", validateHexOrDefault(raw.get("textColor"), "#FFFFFF"));
                props.put("digitBgColor", validateHexOrDefault(raw.get("digitBgColor"), "#111827"));
                props.put("urgentColor", validateHexOrDefault(raw.get("urgentColor"), "#FACC15"));
                props.put("ctaLabel", clip(strOrDefault(raw.get("ctaLabel"), "Grab Deal"), 32));
                props.put("ctaUrl", validateSafeLinkOrDefault(raw.get("ctaUrl"), "/store/shop"));
            }
            case "ambient_glow" -> {
                props.put("style", enumOrDefault(raw.get("style"), Set.of("frost_vignette", "rose_aura", "gold_spotlight", "aurora_ribbon", "crimson_glow"), "gold_spotlight"));
                props.put("primaryColor", validateHexOrDefault(raw.get("primaryColor"), "#FACC15"));
                props.put("secondaryColor", validateHexOrDefault(raw.get("secondaryColor"), "#F43F5E"));
                props.put("intensity", clampDouble(raw.get("intensity"), 0.05, 0.9, 0.35));
            }
            case "floating_sticker" -> {
                props.put("text", clip(strOrDefault(raw.get("text"), "SPECIAL"), 28));
                props.put("subtext", clip(strOrDefault(raw.get("subtext"), ""), 40));
                props.put("icon", enumOrDefault(raw.get("icon"), Set.of("sparkles", "flame", "gift", "heart", "snowflake", "tag"), "sparkles"));
                props.put("anchor", enumOrDefault(raw.get("anchor"), Set.of("top-left", "top-right", "bottom-left", "bottom-right"), "bottom-left"));
                props.put("offsetX", clampInt(raw.get("offsetX"), 1, 40, 2));
                props.put("offsetY", clampInt(raw.get("offsetY"), 2, 40, 12));
                props.put("bgColor", validateHexOrDefault(raw.get("bgColor"), "#DC2626"));
                props.put("textColor", validateHexOrDefault(raw.get("textColor"), "#FFFFFF"));
                props.put("motion", enumOrDefault(raw.get("motion"), Set.of("float", "pulse", "gentle_swing", "none"), "float"));
                String link = strOrDefault(raw.get("linkUrl"), "");
                if (StringUtils.hasText(link)) {
                    BlockSchemaValidator.validateSafeUrl(link, "floating_sticker.linkUrl", false);
                }
                props.put("linkUrl", link);
            }
            default -> {
            }
        }
        return props;
    }

    public static String defaultZoneFor(String type) {
        return switch (type) {
            case "promo_banner", "countdown_bar" -> "top_announcement";
            case "string_lights", "festive_lanterns" -> "header_frame";
            case "santa_sleigh" -> "hero_stage";
            case "floating_sticker" -> "floating_corner";
            default -> "viewport_overlay";
        };
    }

    public static String conflictGroupForLayerType(String type) {
        if (type == null) return "viewport_overlay";
        return switch (type) {
            case "snowfall", "blossom_petals", "floating_hearts", "golden_particles", "fireworks", "confetti_burst" -> "weather_particles";
            case "string_lights", "festive_lanterns" -> "header_decor";
            case "corner_floral_frame" -> "corner_decor";
            case "promo_banner", "countdown_bar" -> "top_banner";
            case "ambient_glow" -> "ambient_backdrop";
            case "floating_sticker", "santa_sleigh" -> "floating_widget";
            default -> "viewport_overlay";
        };
    }

    private String validateHex(String raw, String field) {
        String hex = raw.trim();
        if (!ThemeTokenValidator.HEX_COLOR.matcher(hex).matches()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, field + " must be a 6-digit hex color (#RRGGBB)");
        }
        return hex.toUpperCase(Locale.ROOT);
    }

    private String validateHexOrDefault(Object raw, String fallback) {
        if (raw == null || !StringUtils.hasText(String.valueOf(raw))) {
            return fallback;
        }
        return validateHex(String.valueOf(raw), "color");
    }

    private List<String> validateHexList(Object raw, List<String> fallback) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return fallback;
        }
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            if (item == null) continue;
            out.add(validateHex(String.valueOf(item), "colors[]"));
            if (out.size() >= 8) break;
        }
        return out.isEmpty() ? fallback : List.copyOf(out);
    }

    private List<String> validateEnumList(Object raw, Set<String> allowed, List<String> fallback) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return fallback;
        }
        Set<String> out = new LinkedHashSet<>();
        for (Object item : list) {
            if (item == null) continue;
            String clean = String.valueOf(item).trim().toLowerCase(Locale.ROOT);
            if (allowed.contains(clean)) {
                out.add(clean);
            }
        }
        return out.isEmpty() ? fallback : List.copyOf(out);
    }

    private String validateSafeLinkOrDefault(Object raw, String fallback) {
        String val = strOrDefault(raw, fallback);
        if (!StringUtils.hasText(val)) return fallback;
        BlockSchemaValidator.validateSafeUrl(val, "ctaUrl", false);
        return val;
    }

    private static String enumOrDefault(Object raw, Set<String> allowed, String fallback) {
        if (raw == null) return fallback;
        String clean = String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
        if (!allowed.contains(clean)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported value '" + clean + "'; allowed: " + allowed);
        }
        return clean;
    }

    private static int clampInt(Object raw, int min, int max, int fallback) {
        if (raw == null) return fallback;
        int val;
        if (raw instanceof Number n) {
            val = n.intValue();
        } else {
            try {
                val = Integer.parseInt(String.valueOf(raw).trim());
            } catch (NumberFormatException ex) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Expected integer value, got: " + raw);
            }
        }
        return Math.max(min, Math.min(max, val));
    }

    private static double clampDouble(Object raw, double min, double max, double fallback) {
        if (raw == null) return fallback;
        double val;
        if (raw instanceof Number n) {
            val = n.doubleValue();
        } else {
            try {
                val = Double.parseDouble(String.valueOf(raw).trim());
            } catch (NumberFormatException ex) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Expected numeric value, got: " + raw);
            }
        }
        if (Double.isNaN(val) || Double.isInfinite(val)) return fallback;
        return Math.max(min, Math.min(max, val));
    }

    private static String strOrDefault(Object raw, String fallback) {
        if (raw == null) return fallback;
        String s = String.valueOf(raw).trim();
        return s.isEmpty() ? fallback : s;
    }

    private static String clip(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
