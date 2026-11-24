package com.datcommerce.api.ai;

import com.datcommerce.api.cms.BlockSchemaValidator;
import com.datcommerce.api.cms.ThemeTokenValidator;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class EditorOperationValidator {

    private static final int MAX_OPERATIONS = 20;
    private static final Pattern SAFE_PART_PATTERN = Pattern.compile("^[a-z0-9_-]{1,40}$");
    private static final Set<String> ALLOWED_OP_TYPES = Set.of(
            "update_props",
            "update_styles",
            "reset_style_keys",
            "update_part_styles",
            "reset_part_style_keys",
            "update_visibility",
            "update_meta",
            "insert_node",
            "move_node",
            "duplicate_node",
            "delete_node",
            "replace_subtree",
            "update_typography_font",
            "update_typography_preset",
            "reset_typography_preset"
    );
    private static final Set<String> ALLOWED_BREAKPOINTS = Set.of("base", "tablet", "mobile", "hover");

    public List<Map<String, Object>> validateAndNormalize(
            List<Map<String, Object>> rawOps,
            String scope,
            Set<String> allowedTargetIds,
            Set<String> existingPageIds
    ) {
        return validateAndNormalize(rawOps, scope, allowedTargetIds, existingPageIds, null);
    }

    public List<Map<String, Object>> validateAndNormalize(
            List<Map<String, Object>> rawOps,
            String scope,
            Set<String> allowedTargetIds,
            Set<String> existingPageIds,
            Map<String, Object> themeTokens
    ) {
        if (rawOps == null || rawOps.isEmpty()) {
            return List.of();
        }
        if (rawOps.size() > MAX_OPERATIONS) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "AI cannot emit more than " + MAX_OPERATIONS + " operations at once"
            );
        }

        BlockSchemaValidator.assertSafeRecursive(rawOps, "ai.operations");

        String normalizedScope = StringUtils.hasText(scope)
                ? scope.trim().toLowerCase(Locale.ROOT)
                : "element";

        Set<String> customFonts = extractCustomFonts(themeTokens);
        Set<String> availablePresets = extractPresetIds(themeTokens);
        List<Map<String, Object>> cleaned = new ArrayList<>();
        Set<String> insertedIds = new HashSet<>();

        for (int i = 0; i < rawOps.size(); i++) {
            Map<String, Object> raw = rawOps.get(i);
            if (raw == null) {
                continue;
            }
            String opType = str(raw.get("type")).toLowerCase(Locale.ROOT);
            if (!ALLOWED_OP_TYPES.contains(opType)) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Unsupported AI editor operation type: " + opType
                );
            }

            Map<String, Object> opOut = new LinkedHashMap<>();
            opOut.put("type", opType);

            switch (opType) {
                case "update_props" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    Map<String, Object> props = mapOf(raw.get("props"), "update_props.props");
                    for (String k : List.of("href", "url", "actionUrl", "videoUrl", "image", "src", "posterUrl")) {
                        if (props.get(k) instanceof String u && StringUtils.hasText(u)) {
                            BlockSchemaValidator.validateSafeUrl(
                                    u,
                                    "ai.update_props." + k,
                                    Set.of("image", "src", "posterUrl").contains(k)
                            );
                        }
                    }
                    opOut.put("nodeId", nodeId);
                    opOut.put("props", props);
                }
                case "update_styles" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    String bp = str(raw.get("breakpoint")).toLowerCase(Locale.ROOT);
                    if (!StringUtils.hasText(bp)) {
                        bp = "base";
                    }
                    if (!ALLOWED_BREAKPOINTS.contains(bp)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid AI style breakpoint: " + bp);
                    }
                    Map<String, Object> rawStyles = mapOf(raw.get("styles"), "update_styles.styles");
                    Map<String, String> safeStyles = BlockSchemaValidator.sanitizeStyleMap(
                            rawStyles,
                            "ai.update_styles." + bp
                    );
                    if (!safeStyles.isEmpty()) {
                        opOut.put("nodeId", nodeId);
                        opOut.put("breakpoint", bp);
                        opOut.put("styles", safeStyles);
                    } else {
                        continue;
                    }
                }
                case "reset_style_keys" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    String bp = str(raw.get("breakpoint")).toLowerCase(Locale.ROOT);
                    if (!ALLOWED_BREAKPOINTS.contains(bp)) {
                        bp = "base";
                    }
                    List<String> keys = new ArrayList<>();
                    if (raw.get("keys") instanceof List<?> rawKeys) {
                        for (Object k : rawKeys) {
                            String ks = str(k);
                            if (BlockSchemaValidator.ALLOWED_STYLE_PROPERTIES.contains(ks)) {
                                keys.add(ks);
                            }
                        }
                    }
                    if (keys.isEmpty()) {
                        continue;
                    }
                    opOut.put("nodeId", nodeId);
                    opOut.put("breakpoint", bp);
                    opOut.put("keys", keys);
                }
                case "update_part_styles" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    String part = str(raw.get("part")).toLowerCase(Locale.ROOT);
                    if (!SAFE_PART_PATTERN.matcher(part).matches()) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid AI sub-element part key: " + part);
                    }
                    String bp = str(raw.get("breakpoint")).toLowerCase(Locale.ROOT);
                    if (!StringUtils.hasText(bp)) {
                        bp = "base";
                    }
                    if (!ALLOWED_BREAKPOINTS.contains(bp)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid AI style breakpoint: " + bp);
                    }
                    Map<String, Object> rawStyles = mapOf(raw.get("styles"), "update_part_styles.styles");
                    Map<String, String> safeStyles = BlockSchemaValidator.sanitizeStyleMap(
                            rawStyles,
                            "ai.update_part_styles." + part + "." + bp
                    );
                    if (!safeStyles.isEmpty()) {
                        opOut.put("nodeId", nodeId);
                        opOut.put("part", part);
                        opOut.put("breakpoint", bp);
                        opOut.put("styles", safeStyles);
                    } else {
                        continue;
                    }
                }
                case "reset_part_style_keys" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    String part = str(raw.get("part")).toLowerCase(Locale.ROOT);
                    if (!SAFE_PART_PATTERN.matcher(part).matches()) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid AI sub-element part key: " + part);
                    }
                    String bp = str(raw.get("breakpoint")).toLowerCase(Locale.ROOT);
                    if (!ALLOWED_BREAKPOINTS.contains(bp)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid AI style breakpoint: " + bp);
                    }
                    List<String> keys = new ArrayList<>();
                    if (raw.get("keys") instanceof List<?> rawKeys) {
                        for (Object k : rawKeys) {
                            String ks = str(k);
                            if (BlockSchemaValidator.ALLOWED_STYLE_PROPERTIES.contains(ks)) {
                                keys.add(ks);
                            }
                        }
                    }
                    if (keys.isEmpty()) {
                        continue;
                    }
                    opOut.put("nodeId", nodeId);
                    opOut.put("part", part);
                    opOut.put("breakpoint", bp);
                    opOut.put("keys", keys);
                }
                case "update_visibility" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    opOut.put("nodeId", nodeId);
                    if (raw.get("visible") != null) {
                        opOut.put("visible", Boolean.TRUE.equals(raw.get("visible")));
                    }
                    if (raw.get("visibility") instanceof Map<?, ?> vis) {
                        Map<String, Object> cleanVis = new LinkedHashMap<>();
                        for (String bp : List.of("desktop", "tablet", "mobile")) {
                            if (vis.get(bp) != null) {
                                cleanVis.put(bp, Boolean.TRUE.equals(vis.get(bp)));
                            }
                        }
                        opOut.put("visibility", cleanVis);
                    }
                }
                case "update_meta" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    opOut.put("nodeId", nodeId);
                    if (raw.get("label") != null) {
                        String label = str(raw.get("label"));
                        if (StringUtils.hasText(label)) {
                            opOut.put("label", label.length() > 120 ? label.substring(0, 120) : label);
                        }
                    }
                    if (raw.get("locked") != null) {
                        opOut.put("locked", Boolean.TRUE.equals(raw.get("locked")));
                    }
                }
                case "insert_node" -> {
                    Object parentObj = raw.get("parentId");
                    String parentId = parentObj == null ? null : str(parentObj);
                    boolean invalidElementInsertParent = "element".equals(normalizedScope)
                            && (parentId == null
                                ? !allowedTargetIds.isEmpty()
                                : (!allowedTargetIds.contains(parentId) && !insertedIds.contains(parentId)));
                    if (invalidElementInsertParent) {
                        throw new ApiException(
                                ErrorCode.VALIDATION_ERROR,
                                "AI insert_node parentId '" + parentId + "' is outside element scope"
                        );
                    }
                    if (!(raw.get("node") instanceof Map<?, ?> rawNode)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "insert_node requires a node object");
                    }
                    BlockSchemaValidator treeValidator = new BlockSchemaValidator();
                    Set<String> ids = new HashSet<>(existingPageIds);
                    ids.addAll(insertedIds);
                    Map<String, Object> cleanNode = treeValidator.normalizeV2Node(
                            rawNode,
                            "ai.insert_node.node",
                            1,
                            ids,
                            new int[] { existingPageIds.size() + insertedIds.size() }
                    );
                    collectIds(cleanNode, insertedIds);
                    opOut.put("parentId", parentId);
                    if (raw.get("index") instanceof Number idxNum) {
                        opOut.put("index", Math.max(0, idxNum.intValue()));
                    }
                    opOut.put("node", cleanNode);
                }
                case "replace_subtree" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    if (!(raw.get("node") instanceof Map<?, ?> rawNode)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "replace_subtree requires a node object");
                    }
                    BlockSchemaValidator treeValidator = new BlockSchemaValidator();
                    Set<String> ids = new HashSet<>(existingPageIds);
                    ids.remove(nodeId);
                    Map<String, Object> cleanNode = treeValidator.normalizeV2Node(
                            rawNode,
                            "ai.replace_subtree.node",
                            1,
                            ids,
                            new int[] { existingPageIds.size() }
                    );
                    collectIds(cleanNode, insertedIds);
                    opOut.put("nodeId", nodeId);
                    opOut.put("node", cleanNode);
                }
                case "move_node" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    String targetParentId = raw.get("targetParentId") == null ? null : str(raw.get("targetParentId"));
                    int index = raw.get("index") instanceof Number n ? Math.max(0, n.intValue()) : 0;
                    opOut.put("nodeId", nodeId);
                    opOut.put("targetParentId", targetParentId);
                    opOut.put("index", index);
                }
                case "duplicate_node", "delete_node" -> {
                    String nodeId = requireTargetNode(raw.get("nodeId"), normalizedScope, allowedTargetIds, insertedIds, existingPageIds, opType);
                    opOut.put("nodeId", nodeId);
                }
                case "update_typography_font" -> {
                    requireTypographyScope(normalizedScope, opType);
                    String role = str(raw.get("role")).toLowerCase(Locale.ROOT);
                    if (!ThemeTokenValidator.ALLOWED_FONT_ROLES.contains(role)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid typography font role: " + role);
                    }
                    String family = str(raw.get("family"));
                    if (!ThemeTokenValidator.ALLOWED_BUILTIN_FONTS.contains(family) && !customFonts.contains(family)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported font family: " + family);
                    }
                    opOut.put("role", role);
                    opOut.put("family", family);
                    if (raw.get("source") != null) {
                        String source = str(raw.get("source")).toLowerCase(Locale.ROOT);
                        if (ThemeTokenValidator.ALLOWED_FONT_SOURCES.contains(source) && !"custom".equals(source)) {
                            opOut.put("source", source);
                        }
                    }
                    if (raw.get("fallback") != null && StringUtils.hasText(str(raw.get("fallback")))) {
                        opOut.put("fallback", str(raw.get("fallback")));
                    }
                    if (raw.get("style") != null) {
                        opOut.put("style", ThemeTokenValidator.validateEnum(str(raw.get("style")), Set.of("normal", "italic"), "style", "ai.update_typography_font"));
                    }
                    if (raw.get("weights") instanceof List<?> rawWeights && !rawWeights.isEmpty()) {
                        List<Integer> cleanW = new ArrayList<>();
                        for (Object w : rawWeights) {
                            cleanW.add(ThemeTokenValidator.parseFontWeightInt(w, "ai.update_typography_font.weights"));
                        }
                        opOut.put("weights", cleanW);
                    }
                }
                case "update_typography_preset" -> {
                    requireTypographyScope(normalizedScope, opType);
                    String target = str(raw.get("target")).toLowerCase(Locale.ROOT);
                    if (!availablePresets.contains(target)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unknown typography preset target: " + target);
                    }
                    opOut.put("target", target);
                    if (raw.get("patch") instanceof Map<?, ?> rawPatch && !rawPatch.isEmpty()) {
                        Map<String, Object> cleanPatch = new LinkedHashMap<>();
                        for (Map.Entry<?, ?> entry : rawPatch.entrySet()) {
                            String prop = str(entry.getKey());
                            if (!ThemeTokenValidator.ALLOWED_PRESET_PROPERTIES.contains(prop)) {
                                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported typography preset property: " + prop);
                            }
                            Object cleanVal = ThemeTokenValidator.validatePresetPropertyValue(prop, entry.getValue(), customFonts, "ai.update_typography_preset." + target);
                            if (cleanVal != null) {
                                cleanPatch.put(prop, cleanVal);
                            }
                        }
                        if (cleanPatch.isEmpty()) {
                            continue;
                        }
                        opOut.put("patch", cleanPatch);
                    } else {
                        String prop = str(raw.get("property"));
                        if (!ThemeTokenValidator.ALLOWED_PRESET_PROPERTIES.contains(prop)) {
                            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported typography preset property: " + prop);
                        }
                        Object valSource = raw.get("responsiveValues") != null ? raw.get("responsiveValues") : raw.get("value");
                        if (valSource == null) {
                            throw new ApiException(ErrorCode.VALIDATION_ERROR, "update_typography_preset requires value or responsiveValues");
                        }
                        Object cleanVal = ThemeTokenValidator.validatePresetPropertyValue(prop, valSource, customFonts, "ai.update_typography_preset." + target);
                        opOut.put("property", prop);
                        if (cleanVal instanceof Map<?, ?>) {
                            opOut.put("responsiveValues", cleanVal);
                        } else {
                            opOut.put("value", cleanVal);
                        }
                    }
                }
                case "reset_typography_preset" -> {
                    requireTypographyScope(normalizedScope, opType);
                    String target = str(raw.get("target")).toLowerCase(Locale.ROOT);
                    if (!"all".equals(target) && !availablePresets.contains(target)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unknown typography preset reset target: " + target);
                    }
                    opOut.put("target", target);
                }
            }

            cleaned.add(opOut);
        }

        return cleaned;
    }

    private static String requireTargetNode(
            Object rawNodeId,
            String scope,
            Set<String> allowedTargetIds,
            Set<String> insertedIds,
            Set<String> existingPageIds,
            String opType
    ) {
        String nodeId = str(rawNodeId);
        if (!StringUtils.hasText(nodeId)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "AI operation " + opType + " missing nodeId");
        }
        if ("element".equals(scope) && !allowedTargetIds.contains(nodeId) && !insertedIds.contains(nodeId)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "AI operation '" + opType + "' attempted to modify node '" + nodeId + "' outside selected element scope"
            );
        }
        if ("section".equals(scope) && !allowedTargetIds.isEmpty()
                && !allowedTargetIds.contains(nodeId) && !insertedIds.contains(nodeId)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "AI operation '" + opType + "' attempted to modify node '" + nodeId + "' outside section scope"
            );
        }
        if (!existingPageIds.contains(nodeId) && !insertedIds.contains(nodeId)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "AI operation referenced unknown nodeId: " + nodeId
            );
        }
        return nodeId;
    }

    private static void collectIds(Map<String, Object> node, Set<String> out) {
        Object id = node.get("id");
        if (id != null) {
            out.add(String.valueOf(id));
        }
        if (node.get("children") instanceof List<?> children) {
            for (Object ch : children) {
                if (ch instanceof Map<?, ?> m) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> cm = (Map<String, Object>) m;
                    collectIds(cm, out);
                }
            }
        }
    }

    private static Map<String, Object> mapOf(Object obj, String field) {
        if (!(obj instanceof Map<?, ?> raw)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, field + " must be an object");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        raw.forEach((k, v) -> {
            if (k != null) {
                out.put(String.valueOf(k), v);
            }
        });
        return out;
    }

    private static void requireTypographyScope(String scope, String opType) {
        if (!"typography".equals(scope) && !"page".equals(scope)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "AI operation '" + opType + "' requires typography or page scope (current scope: " + scope + ")"
            );
        }
    }

    private static Set<String> extractCustomFonts(Map<String, Object> themeTokens) {
        Set<String> out = new HashSet<>();
        if (themeTokens != null && themeTokens.get("typography") instanceof Map<?, ?> typo
                && typo.get("fonts") instanceof Map<?, ?> fonts) {
            for (Object cfgObj : fonts.values()) {
                if (cfgObj instanceof Map<?, ?> cfg && "custom".equals(String.valueOf(cfg.get("source")))
                        && cfg.get("family") instanceof String f && StringUtils.hasText(f)) {
                    out.add(f.trim());
                }
            }
        }
        return out;
    }

    private static Set<String> extractPresetIds(Map<String, Object> themeTokens) {
        Set<String> out = new HashSet<>(ThemeTokenValidator.DEFAULT_PRESET_IDS);
        if (themeTokens != null && themeTokens.get("typography") instanceof Map<?, ?> typo
                && typo.get("presets") instanceof Map<?, ?> presets) {
            for (Object key : presets.keySet()) {
                if (key != null) {
                    out.add(String.valueOf(key).trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        return out;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
