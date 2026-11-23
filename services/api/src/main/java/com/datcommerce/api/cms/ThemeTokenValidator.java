package com.datcommerce.api.cms;

import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class ThemeTokenValidator {

    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");
    private static final Pattern PX_VALUE = Pattern.compile("^(\\d{1,4})px$");

    private static final Set<String> COLOR_KEYS = Set.of(
            "primary", "background", "surface", "text", "muted", "accent"
    );
    private static final Set<String> REQUIRED_COLORS = Set.of("primary", "background", "text");
    private static final Set<String> ALLOWED_FONTS = Set.of(
            "Inter", "Georgia", "Plus Jakarta Sans", "DM Sans", "Merriweather", "JetBrains Mono"
    );

    public static Map<String, Object> defaultTokens() {
        Map<String, Object> colors = new LinkedHashMap<>();
        colors.put("primary", "#5B46E8");
        colors.put("background", "#FFFFFF");
        colors.put("surface", "#F8FAFC");
        colors.put("text", "#111318");
        colors.put("muted", "#5C6270");
        colors.put("accent", "#18794E");

        Map<String, Object> typography = new LinkedHashMap<>();
        typography.put("headingFont", "Georgia");
        typography.put("bodyFont", "Inter");

        Map<String, Object> radius = new LinkedHashMap<>();
        radius.put("card", "10px");
        radius.put("button", "8px");

        Map<String, Object> container = new LinkedHashMap<>();
        container.put("maxWidth", "1280px");

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("version", 1);
        root.put("colors", colors);
        root.put("typography", typography);
        root.put("radius", radius);
        root.put("container", container);
        return root;
    }

    public Map<String, Object> validateAndNormalize(Map<String, Object> rawTokens) {
        if (rawTokens == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Theme tokens payload is required");
        }
        BlockSchemaValidator.assertSafeRecursive(rawTokens, "tokens");

        Map<String, Object> defaults = defaultTokens();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", 1);

        // Colors
        Object colorsObj = rawTokens.get("colors");
        if (!(colorsObj instanceof Map<?, ?> rawColors)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "tokens.colors object is required");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> colors = new LinkedHashMap<>((Map<String, Object>) defaults.get("colors"));
        for (Map.Entry<?, ?> entry : rawColors.entrySet()) {
            String key = String.valueOf(entry.getKey());
            if (!COLOR_KEYS.contains(key)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported theme color token: " + key);
            }
            String hex = String.valueOf(entry.getValue()).trim();
            if (!HEX_COLOR.matcher(hex).matches()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Color '" + key + "' must be a 6-digit hex code");
            }
            colors.put(key, hex.toUpperCase());
        }
        for (String req : REQUIRED_COLORS) {
            if (!colors.containsKey(req)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Missing required theme color: " + req);
            }
        }
        out.put("colors", colors);

        // Typography
        @SuppressWarnings("unchecked")
        Map<String, Object> typography = new LinkedHashMap<>((Map<String, Object>) defaults.get("typography"));
        if (rawTokens.get("typography") instanceof Map<?, ?> rawTypo) {
            for (String key : Set.of("headingFont", "bodyFont")) {
                if (rawTypo.get(key) != null) {
                    String font = String.valueOf(rawTypo.get(key)).trim();
                    if (!ALLOWED_FONTS.contains(font)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported font for " + key + ": " + font);
                    }
                    typography.put(key, font);
                }
            }
        }
        out.put("typography", typography);

        // Radius
        @SuppressWarnings("unchecked")
        Map<String, Object> radius = new LinkedHashMap<>((Map<String, Object>) defaults.get("radius"));
        if (rawTokens.get("radius") instanceof Map<?, ?> rawRadius) {
            if (rawRadius.get("card") != null) {
                radius.put("card", validatePxRange(String.valueOf(rawRadius.get("card")), 0, 24, "radius.card"));
            }
            if (rawRadius.get("button") != null) {
                radius.put("button", validatePxRange(String.valueOf(rawRadius.get("button")), 0, 999, "radius.button"));
            }
        }
        out.put("radius", radius);

        // Container
        @SuppressWarnings("unchecked")
        Map<String, Object> container = new LinkedHashMap<>((Map<String, Object>) defaults.get("container"));
        if (rawTokens.get("container") instanceof Map<?, ?> rawContainer && rawContainer.get("maxWidth") != null) {
            container.put("maxWidth", validatePxRange(String.valueOf(rawContainer.get("maxWidth")), 1024, 1536, "container.maxWidth"));
        }
        out.put("container", container);

        return out;
    }

    private static String validatePxRange(String raw, int min, int max, String field) {
        String trimmed = raw.trim();
        Matcher m = PX_VALUE.matcher(trimmed);
        if (!m.matches()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, field + " must be specified in px");
        }
        int val = Integer.parseInt(m.group(1));
        if (val < min || val > max) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, field + " must be between " + min + "px and " + max + "px");
        }
        return val + "px";
    }
}
