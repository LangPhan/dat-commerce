package com.datcommerce.api.cms;

import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class BlockSchemaValidator {

    public static final int MAX_V2_NODES = 250;
    public static final int MAX_V2_DEPTH = 12;

    public static final Set<String> ALLOWED_TYPES = Set.of(
            "hero",
            "image_with_text",
            "product_grid",
            "featured_categories",
            "best_sellers",
            "collection_banner",
            "promotional_banner",
            "testimonials",
            "newsletter",
            "rich_text",
            "image_gallery",
            "faq",
            "logo_cloud",
            "video_section"
    );

    public static final Set<String> V2_CONTAINER_TYPES = Set.of(
            "section",
            "container",
            "grid",
            "flex",
            "columns",
            "column"
    );

    public static final Set<String> V2_ELEMENT_TYPES = Set.of(
            // Layout (6 containers + spacer = 7)
            "section", "container", "grid", "flex", "columns", "column", "spacer",
            // Basic (9)
            "heading", "text_editor", "image", "video", "button",
            "icon", "divider", "icon_list", "image_gallery",
            // Ecommerce (9)
            "product_card", "product_grid", "product_carousel", "category_grid",
            "featured_product", "price", "add_to_cart", "product_info", "promotion_banner",
            // Advanced (6)
            "tabs", "accordion", "carousel", "countdown", "form", "custom_html"
    );

    public static final Set<String> ALLOWED_STYLE_PROPERTIES = Set.of(
            "display", "flexDirection", "justifyContent", "alignItems", "alignSelf",
            "flexWrap", "flexGrow", "flexShrink", "gap", "rowGap", "columnGap",
            "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow",
            "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight",
            "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
            "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
            "position", "top", "right", "bottom", "left", "zIndex", "overflow",
            "textAlign", "color", "backgroundColor", "backgroundImage", "backgroundSize",
            "backgroundPosition", "fontFamily", "fontSize", "fontWeight", "lineHeight",
            "letterSpacing", "textTransform", "textDecoration", "borderWidth",
            "borderStyle", "borderColor", "borderRadius", "boxShadow", "opacity",
            "aspectRatio", "objectFit", "objectPosition", "cursor"
    );

    private static final Set<String> ALLOWED_TONES = Set.of("forest", "ink", "light");
    private static final Set<String> ALLOWED_LAYOUTS = Set.of("overlay", "split", "centered");
    private static final Set<String> ALLOWED_SCALES = Set.of("regular", "large");
    private static final Set<String> ALLOWED_SPACINGS = Set.of("compact", "comfortable", "spacious");
    private static final Set<String> URL_KEYS = Set.of(
            "actionUrl", "videoUrl", "image", "src", "href", "url", "posterUrl"
    );
    private static final Set<String> MEDIA_URL_KEYS = Set.of("image", "src", "posterUrl");
    private static final Set<String> STYLE_BREAKPOINTS = Set.of("base", "tablet", "mobile", "hover");

    private static final Pattern SAFE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{1,80}$");
    private static final Pattern SAFE_CLASS_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final Pattern SAFE_ATTR_NAME_PATTERN = Pattern.compile("^(aria-[a-z0-9-]+|data-[a-z0-9-]+|role|id|title|tabindex)$");
    private static final Pattern DANGEROUS_HTML = Pattern.compile(
            "(?i)<\\s*(script|iframe|object|embed|style|link|meta|base|form)\\b|\\bon[a-z]{2,}\\s*=|(javascript|vbscript):|data\\s*:\\s*text/html|expression\\s*\\("
    );
    private static final Pattern DANGEROUS_CUSTOM_HTML = Pattern.compile(
            "(?i)<\\s*(script|iframe|object|embed|style|link|meta|base)\\b|\\bon[a-z]{2,}\\s*=|(javascript|vbscript):|data\\s*:\\s*text/html"
    );
    private static final Pattern UNSAFE_STYLE_VALUE = Pattern.compile(
            "(?i)(expression\\s*\\(|javascript:|vbscript:|behavior\\s*:|@import|<|>|\\{|\\}|;)"
    );

    public Map<String, Object> validateAndNormalizeContent(Map<String, Object> rawContent) {
        if (rawContent == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Page content payload is required");
        }
        assertSafeRecursive(rawContent, "content");

        Object versionObj = rawContent.get("version");
        boolean isV2 = rawContent.containsKey("nodes")
                || (versionObj instanceof Number n && n.intValue() == 2);

        if (isV2) {
            return validateAndNormalizeV2Content(rawContent);
        }

        Object blocksObj = rawContent.get("blocks");
        if (!(blocksObj instanceof List<?> rawBlocks)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "content.blocks must be an array");
        }
        if (rawBlocks.size() > 40) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "A page cannot exceed 40 blocks");
        }

        List<Map<String, Object>> normalizedBlocks = new ArrayList<>();
        for (int i = 0; i < rawBlocks.size(); i++) {
            Object entry = rawBlocks.get(i);
            if (!(entry instanceof Map<?, ?> rawMap)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block at index " + i + " must be an object");
            }
            normalizedBlocks.add(normalizeBlock(rawMap, i));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", 1);
        out.put("blocks", normalizedBlocks);
        return out;
    }

    private Map<String, Object> validateAndNormalizeV2Content(Map<String, Object> rawContent) {
        Object nodesObj = rawContent.get("nodes");
        if (!(nodesObj instanceof List<?> rawNodes)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "v2 content.nodes must be an array");
        }

        Set<String> seenIds = new HashSet<>();
        int[] totalCount = new int[] { 0 };
        List<Map<String, Object>> normalizedNodes = new ArrayList<>();
        for (int i = 0; i < rawNodes.size(); i++) {
            Object entry = rawNodes.get(i);
            if (!(entry instanceof Map<?, ?> rawMap)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Node at root[" + i + "] must be an object");
            }
            normalizedNodes.add(normalizeV2Node(rawMap, "nodes[" + i + "]", 1, seenIds, totalCount));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", 2);
        out.put("nodes", normalizedNodes);
        if (rawContent.get("meta") instanceof Map<?, ?> rawMeta) {
            Map<String, Object> meta = new LinkedHashMap<>();
            rawMeta.forEach((k, v) -> {
                if (k != null) {
                    meta.put(String.valueOf(k), v);
                }
            });
            out.put("meta", meta);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> normalizeV2Node(
            Map<?, ?> rawMap,
            String path,
            int depth,
            Set<String> seenIds,
            int[] totalCount
    ) {
        if (depth > MAX_V2_DEPTH) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "Page hierarchy exceeds maximum nesting depth of " + MAX_V2_DEPTH + " at " + path
            );
        }
        totalCount[0] += 1;
        if (totalCount[0] > MAX_V2_NODES) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "A page cannot exceed " + MAX_V2_NODES + " total elements"
            );
        }

        String id = str(rawMap.get("id"));
        if (!SAFE_ID_PATTERN.matcher(id).matches()) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "Element at " + path + " requires an alphanumeric/dash/underscore id (1..80 chars)"
            );
        }
        if (!seenIds.add(id)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Duplicate element id in page: " + id);
        }

        String type = str(rawMap.get("type")).toLowerCase(Locale.ROOT);
        if (!V2_ELEMENT_TYPES.contains(type)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported v2 element type: " + type);
        }

        String label = str(rawMap.get("label"));
        if (!StringUtils.hasText(label) || label.length() > 120) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "Element '" + id + "' label must be 1..120 characters"
            );
        }

        boolean visible = rawMap.get("visible") == null || Boolean.TRUE.equals(rawMap.get("visible"));
        boolean locked = Boolean.TRUE.equals(rawMap.get("locked"));

        Object propsObj = rawMap.get("props");
        if (propsObj != null && !(propsObj instanceof Map<?, ?>)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Element '" + id + "' props must be an object");
        }
        Map<String, Object> props = normalizeV2Props(
                propsObj instanceof Map<?, ?> m ? m : Map.of(),
                id,
                type
        );

        Map<String, Object> styles = normalizeResponsiveStyles(rawMap.get("styles"), id);
        Map<String, Object> visibility = normalizeVisibility(rawMap.get("visibility"), id);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("type", type);
        out.put("version", 2);
        out.put("label", label);
        out.put("visible", visible);
        out.put("locked", locked);
        out.put("props", props);
        out.put("styles", styles);
        if (!visibility.isEmpty()) {
            out.put("visibility", visibility);
        }

        Object rawChildrenObj = rawMap.get("children");
        boolean isContainer = V2_CONTAINER_TYPES.contains(type);
        if (rawChildrenObj != null) {
            if (!(rawChildrenObj instanceof List<?> childList)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Element '" + id + "' children must be an array");
            }
            if (!isContainer && !childList.isEmpty()) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Non-container element '" + id + "' (" + type + ") cannot contain children"
                );
            }
            if (isContainer) {
                List<Map<String, Object>> normalizedChildren = new ArrayList<>();
                for (int i = 0; i < childList.size(); i++) {
                    Object child = childList.get(i);
                    if (!(child instanceof Map<?, ?> childMap)) {
                        throw new ApiException(
                                ErrorCode.VALIDATION_ERROR,
                                "Child at " + path + ".children[" + i + "] must be an object"
                        );
                    }
                    normalizedChildren.add(normalizeV2Node(
                            childMap,
                            path + ".children[" + i + "]",
                            depth + 1,
                            seenIds,
                            totalCount
                    ));
                }
                out.put("children", normalizedChildren);
            }
        } else if (isContainer) {
            out.put("children", List.of());
        }

        if (rawMap.get("customCssClasses") instanceof List<?> rawClasses) {
            List<String> cleanClasses = new ArrayList<>();
            for (Object clsObj : rawClasses) {
                String cls = str(clsObj);
                if (!SAFE_CLASS_PATTERN.matcher(cls).matches()) {
                    throw new ApiException(
                            ErrorCode.VALIDATION_ERROR,
                            "Element '" + id + "' has invalid CSS class name: " + cls
                    );
                }
                cleanClasses.add(cls);
            }
            out.put("customCssClasses", cleanClasses);
        }

        if (rawMap.get("htmlAttributes") instanceof Map<?, ?> rawAttrs) {
            Map<String, String> cleanAttrs = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : rawAttrs.entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                String attrName = String.valueOf(entry.getKey()).trim().toLowerCase(Locale.ROOT);
                if (!SAFE_ATTR_NAME_PATTERN.matcher(attrName).matches()) {
                    throw new ApiException(
                            ErrorCode.VALIDATION_ERROR,
                            "Element '" + id + "' has restricted HTML attribute: " + attrName
                    );
                }
                String attrVal = String.valueOf(entry.getValue());
                assertSafeRecursive(attrVal, id + ".htmlAttributes." + attrName);
                cleanAttrs.put(attrName, attrVal.length() > 200 ? attrVal.substring(0, 200) : attrVal);
            }
            out.put("htmlAttributes", cleanAttrs);
        }

        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> normalizeV2Props(Map<?, ?> rawProps, String id, String type) {
        Map<String, Object> props = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : rawProps.entrySet()) {
            if (entry.getKey() != null) {
                props.put(String.valueOf(entry.getKey()), entry.getValue());
            }
        }

        for (String urlKey : URL_KEYS) {
            if (props.get(urlKey) instanceof String u && StringUtils.hasText(u)) {
                validateSafeUrl(u, id + ".props." + urlKey, MEDIA_URL_KEYS.contains(urlKey));
            }
        }

        if ("custom_html".equals(type) && props.get("html") instanceof String html) {
            Matcher m = DANGEROUS_CUSTOM_HTML.matcher(html);
            if (m.find()) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Unsafe tag or script handler rejected in custom_html node '" + id + "'"
                );
            }
        }

        for (String listKey : List.of("items", "slides", "fields")) {
            if (props.get(listKey) instanceof List<?> rawList) {
                List<Map<String, Object>> normalizedList = new ArrayList<>();
                for (Object itemObj : rawList) {
                    if (!(itemObj instanceof Map<?, ?> itemMap)) {
                        throw new ApiException(
                                ErrorCode.VALIDATION_ERROR,
                                "Element '" + id + "' " + listKey + " entries must be objects"
                        );
                    }
                    Map<String, Object> cleanItem = new LinkedHashMap<>((Map<String, Object>) itemMap);
                    for (String k : URL_KEYS) {
                        if (cleanItem.get(k) instanceof String u && StringUtils.hasText(u)) {
                            validateSafeUrl(u, id + ".props." + listKey + "[]." + k, MEDIA_URL_KEYS.contains(k));
                        }
                    }
                    normalizedList.add(cleanItem);
                }
                props.put(listKey, normalizedList);
            }
        }

        return props;
    }

    public static Map<String, Object> normalizeResponsiveStyles(Object rawStylesObj, String id) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (rawStylesObj == null) {
            out.put("base", Map.of());
            return out;
        }
        if (!(rawStylesObj instanceof Map<?, ?> rawStyles)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Element '" + id + "' styles must be an object");
        }
        for (Map.Entry<?, ?> entry : rawStyles.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            String bp = String.valueOf(entry.getKey()).trim().toLowerCase(Locale.ROOT);
            if (!STYLE_BREAKPOINTS.contains(bp)) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Element '" + id + "' has unsupported style breakpoint: " + bp
                );
            }
            if (!(entry.getValue() instanceof Map<?, ?> bpMap)) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Element '" + id + "' styles." + bp + " must be an object"
                );
            }
            out.put(bp, sanitizeStyleMap(bpMap, id + ".styles." + bp));
        }
        out.putIfAbsent("base", Map.of());
        return out;
    }

    public static Map<String, String> sanitizeStyleMap(Map<?, ?> rawMap, String context) {
        Map<String, String> clean = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            String prop = String.valueOf(entry.getKey()).trim();
            if (!ALLOWED_STYLE_PROPERTIES.contains(prop)) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Unsupported CSS property '" + prop + "' at " + context
                );
            }
            String val = String.valueOf(entry.getValue()).trim();
            if (val.isEmpty()) {
                continue;
            }
            if (val.length() > 300 || UNSAFE_STYLE_VALUE.matcher(val).find()) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Unsafe or overly long CSS value for '" + prop + "' at " + context
                );
            }
            clean.put(prop, val);
        }
        return clean;
    }

    private static Map<String, Object> normalizeVisibility(Object rawVis, String id) {
        if (rawVis == null) {
            return Map.of();
        }
        if (!(rawVis instanceof Map<?, ?> map)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Element '" + id + "' visibility must be an object");
        }
        Map<String, Object> clean = new LinkedHashMap<>();
        for (String bp : List.of("desktop", "tablet", "mobile")) {
            Object val = map.get(bp);
            if (val != null) {
                clean.put(bp, Boolean.TRUE.equals(val));
            }
        }
        return clean;
    }

    public static int countNodes(Map<String, Object> content) {
        if (content == null) {
            return 0;
        }
        if (content.get("nodes") instanceof List<?> nodes) {
            return countTree(nodes);
        }
        if (content.get("blocks") instanceof List<?> blocks) {
            return blocks.size();
        }
        return 0;
    }

    private static int countTree(List<?> nodes) {
        int count = 0;
        for (Object item : nodes) {
            count += 1;
            if (item instanceof Map<?, ?> map && map.get("children") instanceof List<?> children) {
                count += countTree(children);
            }
        }
        return count;
    }

    public List<Map<String, Object>> validateNavigationItems(List<Map<String, Object>> items) {
        if (items == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Navigation items array is required");
        }
        if (items.size() > 20) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Navigation menu cannot exceed 20 links");
        }
        assertSafeRecursive(items, "navigation");
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> row = items.get(i);
            String id = str(row.get("id"));
            String label = str(row.get("label"));
            String url = str(row.get("url"));
            if (!StringUtils.hasText(label) || label.length() > 60) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Navigation link label must be 1..60 characters");
            }
            validateSafeUrl(url, "navigation[" + i + "].url", false);
            Map<String, Object> clean = new LinkedHashMap<>();
            clean.put("id", StringUtils.hasText(id) ? id : "nav-" + (i + 1));
            clean.put("label", label.trim());
            clean.put("url", url.trim());
            out.add(clean);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> normalizeBlock(Map<?, ?> rawMap, int index) {
        String id = str(rawMap.get("id"));
        String type = str(rawMap.get("type")).toLowerCase(Locale.ROOT);
        String label = str(rawMap.get("label"));
        Object visibleObj = rawMap.get("visible");
        boolean visible = visibleObj == null || Boolean.TRUE.equals(visibleObj);

        if (!StringUtils.hasText(id) || id.length() > 80) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block " + index + " requires a valid id (1..80 chars)");
        }
        if (!ALLOWED_TYPES.contains(type)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported block type: " + type);
        }
        if (!StringUtils.hasText(label) || label.length() > 80) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block '" + id + "' label must be 1..80 characters");
        }

        Object propsObj = rawMap.get("props");
        if (!(propsObj instanceof Map<?, ?> rawProps)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block '" + id + "' must contain a props object");
        }

        Map<String, Object> props = new LinkedHashMap<>();
        for (Map.Entry<?, ?> e : rawProps.entrySet()) {
            if (e.getKey() != null) {
                props.put(String.valueOf(e.getKey()), e.getValue());
            }
        }

        validateEnumProp(props, "tone", ALLOWED_TONES, id);
        validateEnumProp(props, "layout", ALLOWED_LAYOUTS, id);
        validateEnumProp(props, "scale", ALLOWED_SCALES, id);
        validateEnumProp(props, "spacing", ALLOWED_SPACINGS, id);

        if (props.containsKey("columns") && props.get("columns") != null) {
            int cols = toInt(props.get("columns"), "columns", id);
            if (!Set.of(2, 3, 4).contains(cols)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block '" + id + "' columns must be 2, 3, or 4");
            }
            props.put("columns", cols);
        }
        if (props.containsKey("limit") && props.get("limit") != null) {
            int limit = toInt(props.get("limit"), "limit", id);
            if (limit < 2 || limit > 12) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block '" + id + "' limit must be between 2 and 12");
            }
            props.put("limit", limit);
        }

        for (String urlKey : URL_KEYS) {
            if (props.get(urlKey) instanceof String u && StringUtils.hasText(u)) {
                validateSafeUrl(u, id + ".props." + urlKey, "image".equals(urlKey));
            }
        }

        if (props.get("items") instanceof List<?> rawItems) {
            List<Map<String, Object>> normalizedItems = new ArrayList<>();
            for (Object itemObj : rawItems) {
                if (!(itemObj instanceof Map<?, ?> itemMap)) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block '" + id + "' items must be objects");
                }
                Map<String, Object> cleanItem = new LinkedHashMap<>((Map<String, Object>) itemMap);
                if (cleanItem.get("image") instanceof String itemImg && StringUtils.hasText(itemImg)) {
                    validateSafeUrl(itemImg, id + ".props.items[].image", true);
                }
                normalizedItems.add(cleanItem);
            }
            props.put("items", normalizedItems);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id.trim());
        out.put("type", type);
        out.put("version", 1);
        out.put("label", label.trim());
        out.put("visible", visible);
        out.put("props", props);
        return out;
    }

    public static void assertSafeRecursive(Object node, String path) {
        if (node == null) {
            return;
        }
        if (node instanceof String text) {
            // Allow custom_html node's "html" field to undergo targeted sanitization rather than blocking <form> tags
            if (path.endsWith(".props.html")) {
                return;
            }
            Matcher m = DANGEROUS_HTML.matcher(text);
            if (m.find()) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Unsafe script/HTML/scheme content rejected at " + path
                );
            }
            return;
        }
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                assertSafeRecursive(entry.getValue(), path + "." + key);
            }
            return;
        }
        if (node instanceof List<?> list) {
            for (int i = 0; i < list.size(); i++) {
                assertSafeRecursive(list.get(i), path + "[" + i + "]");
            }
        }
    }

    public static void validateSafeUrl(String rawUrl, String field, boolean isMedia) {
        if (!StringUtils.hasText(rawUrl)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, field + " cannot be blank");
        }
        String u = rawUrl.trim();
        if (u.startsWith("//")) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, field + " must not use protocol-relative // URLs");
        }
        if (isMedia) {
            if (!(u.startsWith("/media/") || u.startsWith("/storage/") || u.startsWith("https://"))) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        field + " must reference /media/..., /storage/..., or https://..."
                );
            }
            return;
        }
        if (!(u.startsWith("/") || u.startsWith("#") || u.startsWith("https://"))) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    field + " must be a relative /, #anchor, or https:// URL"
            );
        }
    }

    private static void validateEnumProp(Map<String, Object> props, String key, Set<String> allowed, String blockId) {
        Object raw = props.get(key);
        if (raw == null) {
            return;
        }
        String val = String.valueOf(raw).trim().toLowerCase(Locale.ROOT);
        if (val.isEmpty()) {
            props.remove(key);
            return;
        }
        if (!allowed.contains(val)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    "Block '" + blockId + "' has invalid " + key + ": " + raw
            );
        }
        props.put(key, val);
    }

    private static int toInt(Object val, String key, String blockId) {
        if (val instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(val).trim());
        } catch (NumberFormatException ex) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Block '" + blockId + "' " + key + " must be a number");
        }
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
