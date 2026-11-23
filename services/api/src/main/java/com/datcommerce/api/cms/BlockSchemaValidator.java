package com.datcommerce.api.cms;

import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import java.util.ArrayList;
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

    private static final Set<String> ALLOWED_TONES = Set.of("forest", "ink", "light");
    private static final Set<String> ALLOWED_LAYOUTS = Set.of("overlay", "split", "centered");
    private static final Set<String> ALLOWED_SCALES = Set.of("regular", "large");
    private static final Set<String> ALLOWED_SPACINGS = Set.of("compact", "comfortable", "spacious");
    private static final Set<String> URL_KEYS = Set.of("actionUrl", "videoUrl", "image");

    private static final Pattern DANGEROUS_HTML = Pattern.compile(
            "(?i)<\\s*(script|iframe|object|embed|style)\\b|\\bon[a-z]{2,}\\s*=|(javascript|vbscript):|data\\s*:\\s*text/html"
    );

    public Map<String, Object> validateAndNormalizeContent(Map<String, Object> rawContent) {
        if (rawContent == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Page content payload is required");
        }
        assertSafeRecursive(rawContent, "content");

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
        if (!(u.startsWith("/") || u.startsWith("https://"))) {
            throw new ApiException(
                    ErrorCode.VALIDATION_ERROR,
                    field + " must be a relative / path or https:// URL"
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
