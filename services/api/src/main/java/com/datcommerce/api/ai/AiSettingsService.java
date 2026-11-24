package com.datcommerce.api.ai;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AiSettingsService {

    private static final Logger log = LoggerFactory.getLogger(AiSettingsService.class);
    private static final Pattern SAFE_MODEL_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9._:/-]{1,160}$");
    private static final String SETTINGS_AI_KEY = "ai";
    private static final String ENABLED_MODEL_IDS_KEY = "enabledModelIds";

    private final StoreRepository storeRepository;
    private final MockAiModelGateway mockGateway;
    private final NineRouterAiGateway nineRouterGateway;
    private final AppProperties appProperties;
    private final AuditLogService auditLogService;

    public AiSettingsService(
            StoreRepository storeRepository,
            MockAiModelGateway mockGateway,
            NineRouterAiGateway nineRouterGateway,
            AppProperties appProperties,
            AuditLogService auditLogService
    ) {
        this.storeRepository = storeRepository;
        this.mockGateway = mockGateway;
        this.nineRouterGateway = nineRouterGateway;
        this.appProperties = appProperties;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public AiDtos.AiModelSettingsDto getSettings(UUID storeId) {
        StoreEntity store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not found"));

        GatewayCatalog catalog = loadGatewayCatalog();
        List<String> persisted = readPersistedEnabledIds(store);
        List<String> enabled = resolveEffectiveEnabledIds(persisted, catalog.models());
        return buildDto(enabled, catalog);
    }

    @Transactional
    public AiDtos.AiModelSettingsDto updateSettings(
            AuthenticatedUser actor,
            AiDtos.UpdateAiModelSettingsRequest request
    ) {
        StoreEntity store = storeRepository.findById(actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not found"));

        if (request == null || request.enabledModelIds() == null || request.enabledModelIds().isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Select at least one enabled AI model");
        }

        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String raw : request.enabledModelIds()) {
            if (!StringUtils.hasText(raw)) {
                continue;
            }
            String trimmed = raw.trim();
            if (!SAFE_MODEL_ID_PATTERN.matcher(trimmed).matches()) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Invalid model id format: " + trimmed
                );
            }
            normalized.add(trimmed);
        }
        if (normalized.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Select at least one enabled AI model");
        }
        if (normalized.size() > 30) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "At most 30 models may be enabled");
        }

        GatewayCatalog catalog = loadGatewayCatalog();
        List<String> previouslyEnabled = readPersistedEnabledIds(store);
        if (catalog.reachable() && !catalog.models().isEmpty()) {
            Set<String> knownIds = new LinkedHashSet<>();
            for (AiModelGateway.AvailableModelInfo m : catalog.models()) {
                knownIds.add(m.id());
            }
            knownIds.addAll(previouslyEnabled);
            for (String candidate : normalized) {
                if (!knownIds.contains(candidate)) {
                    throw new ApiException(
                            ErrorCode.VALIDATION_ERROR,
                            "Model is not in available gateway models: " + candidate
                    );
                }
            }
        }

        List<String> beforeList = resolveEffectiveEnabledIds(previouslyEnabled, catalog.models());
        List<String> nextList = List.copyOf(normalized);

        Map<String, Object> nextSettings = new LinkedHashMap<>(
                store.getSettingsJson() != null ? store.getSettingsJson() : Map.of()
        );
        Map<String, Object> aiNode = new LinkedHashMap<>();
        Object existingAi = nextSettings.get(SETTINGS_AI_KEY);
        if (existingAi instanceof Map<?, ?> map) {
            map.forEach((k, v) -> {
                if (k != null) {
                    aiNode.put(String.valueOf(k), v);
                }
            });
        }
        aiNode.put(ENABLED_MODEL_IDS_KEY, nextList);
        nextSettings.put(SETTINGS_AI_KEY, aiNode);

        store.setSettingsJson(nextSettings);
        store.setUpdatedAt(Instant.now());
        storeRepository.save(store);

        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "AI_SETTINGS_UPDATED",
                "STORE",
                store.getId().toString(),
                Map.of("enabledModelIds", beforeList),
                Map.of("enabledModelIds", nextList),
                Map.of("defaultModelId", nextList.get(0)),
                null
        );

        return buildDto(nextList, catalog);
    }

    private AiDtos.AiModelSettingsDto buildDto(List<String> enabledIds, GatewayCatalog catalog) {
        Map<String, AiDtos.AvailableModelDto> byId = new LinkedHashMap<>();
        for (AiModelGateway.AvailableModelInfo info : catalog.models()) {
            byId.put(info.id(), new AiDtos.AvailableModelDto(
                    info.id(),
                    formatModelLabel(info.id()),
                    info.ownedBy(),
                    info.contextLength(),
                    info.maxOutputTokens(),
                    info.vision(),
                    info.tools(),
                    info.reasoning()
            ));
        }

        // Guarantee configured/enabled model ids always have metadata entries even if gateway is offline
        for (String id : enabledIds) {
            byId.putIfAbsent(id, new AiDtos.AvailableModelDto(
                    id,
                    formatModelLabel(id),
                    "configured",
                    null,
                    null,
                    false,
                    true,
                    false
            ));
        }

        List<AiDtos.AvailableModelDto> availableModels = List.copyOf(byId.values());
        List<String> availableModelIds = availableModels.stream().map(AiDtos.AvailableModelDto::id).toList();
        String defaultModelId = enabledIds.isEmpty()
                ? appProperties.getAi().getDefaultModel()
                : enabledIds.get(0);

        return new AiDtos.AiModelSettingsDto(
                enabledIds,
                availableModelIds,
                availableModels,
                defaultModelId,
                catalog.reachable(),
                catalog.error()
        );
    }

    private GatewayCatalog loadGatewayCatalog() {
        String mode = appProperties.getAi().getGatewayMode();
        boolean useLive = ("9router".equalsIgnoreCase(mode) || "live".equalsIgnoreCase(mode))
                && StringUtils.hasText(appProperties.getAi().getBaseUrl());
        AiModelGateway gateway = useLive ? nineRouterGateway : mockGateway;
        try {
            List<AiModelGateway.AvailableModelInfo> models = gateway.listAvailableModels();
            return new GatewayCatalog(models != null ? models : List.of(), true, null);
        } catch (Exception ex) {
            log.warn("Unable to load available AI models from gateway ({}): {}", mode, ex.getMessage());
            return new GatewayCatalog(List.of(), false, ex.getMessage());
        }
    }

    private List<String> readPersistedEnabledIds(StoreEntity store) {
        Map<String, Object> root = store.getSettingsJson();
        if (root == null) {
            return List.of();
        }
        Object aiObj = root.get(SETTINGS_AI_KEY);
        if (!(aiObj instanceof Map<?, ?> aiMap)) {
            return List.of();
        }
        Object rawList = aiMap.get(ENABLED_MODEL_IDS_KEY);
        if (!(rawList instanceof List<?> items)) {
            return List.of();
        }
        LinkedHashSet<String> cleaned = new LinkedHashSet<>();
        for (Object item : items) {
            if (item != null) {
                String id = String.valueOf(item).trim();
                if (StringUtils.hasText(id)) {
                    cleaned.add(id);
                }
            }
        }
        return List.copyOf(cleaned);
    }

    private List<String> resolveEffectiveEnabledIds(
            List<String> persisted,
            List<AiModelGateway.AvailableModelInfo> available
    ) {
        if (!persisted.isEmpty()) {
            return persisted;
        }
        Set<String> availableSet = new LinkedHashSet<>();
        for (AiModelGateway.AvailableModelInfo m : available) {
            availableSet.add(m.id());
        }

        LinkedHashSet<String> defaults = new LinkedHashSet<>();
        List<String> preferred = List.of(
                appProperties.getAi().getDefaultModel(),
                "gpt-6-luna",
                "cx/gpt-6-luna",
                "claude-code",
                appProperties.getAi().getFastTaskModel()
        );
        for (String candidate : preferred) {
            if (!StringUtils.hasText(candidate)) {
                continue;
            }
            String trimmed = candidate.trim();
            if (availableSet.isEmpty() || availableSet.contains(trimmed)) {
                defaults.add(trimmed);
            }
        }
        if (defaults.isEmpty() && !available.isEmpty()) {
            defaults.add(available.get(0).id());
        }
        if (defaults.isEmpty() && StringUtils.hasText(appProperties.getAi().getDefaultModel())) {
            defaults.add(appProperties.getAi().getDefaultModel().trim());
        }
        return List.copyOf(defaults);
    }

    static String formatModelLabel(String id) {
        if (!StringUtils.hasText(id)) {
            return "";
        }
        return switch (id) {
            case "gpt-6-luna" -> "GPT-6 Luna";
            case "cx/gpt-6-luna" -> "GPT-6 Luna (CX)";
            case "claude-code" -> "Claude Code";
            case "claude-sonnet-4" -> "Claude Sonnet 4";
            case "forma-fast" -> "Forma Fast";
            default -> {
                String tail = id.contains("/") ? id.substring(id.indexOf('/') + 1) : id;
                String prefix = id.contains("/") ? id.substring(0, id.indexOf('/')).toUpperCase(Locale.ROOT) + " · " : "";
                String[] parts = tail.split("[-_]+");
                List<String> words = new ArrayList<>();
                for (String p : parts) {
                    if (p.isEmpty()) {
                        continue;
                    }
                    if ("gpt".equalsIgnoreCase(p) || "cx".equalsIgnoreCase(p) || "ai".equalsIgnoreCase(p)) {
                        words.add(p.toUpperCase(Locale.ROOT));
                    } else {
                        words.add(Character.toUpperCase(p.charAt(0)) + p.substring(1));
                    }
                }
                yield prefix + (words.isEmpty() ? id : String.join(" ", words));
            }
        };
    }

    private record GatewayCatalog(
            List<AiModelGateway.AvailableModelInfo> models,
            boolean reachable,
            String error
    ) {
    }
}
