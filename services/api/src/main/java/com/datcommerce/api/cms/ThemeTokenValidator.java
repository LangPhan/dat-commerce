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
public class ThemeTokenValidator {

    public static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");
    public static final Pattern CSS_VAR_COLOR = Pattern.compile("^var\\(--[A-Za-z0-9_-]{2,48}\\)$");
    private static final Pattern PX_VALUE = Pattern.compile("^(\\d{1,4})px$");
    private static final Pattern SAFE_SHADOW = Pattern.compile("^[0-9A-Za-zpxrm.,()%\\s#-]{1,120}$");
    private static final Pattern SAFE_PALETTE_ID = Pattern.compile("^[A-Za-z0-9_-]{1,40}$");
    public static final Pattern SAFE_PRESET_ID = Pattern.compile("^[a-z0-9_-]{1,48}$");
    private static final Pattern SAFE_CUSTOM_FONT_NAME = Pattern.compile("^[A-Za-z0-9 _.-]{1,64}$");
    private static final Pattern SAFE_FALLBACK = Pattern.compile("^[A-Za-z0-9 ,\"'_-]{1,100}$");
    private static final Pattern SIZE_UNIT_PATTERN = Pattern.compile("^(\\d+(?:\\.\\d+)?)(px|rem|em)$");
    private static final Pattern LETTER_SPACING_PATTERN = Pattern.compile("^((-?\\d+(?:\\.\\d+)?)(px|rem|em)|0)$");
    private static final Pattern LINE_HEIGHT_PATTERN = Pattern.compile("^(\\d+(?:\\.\\d+)?)(px|rem|em)?$");
    public static final Pattern CLAMP_PATTERN = Pattern.compile("^clamp\\(\\s*[0-9.,+\\-pxremvwchq%\\s/*()]{3,90}\\)$");
    public static final Pattern SAFE_TEXT_SHADOW = Pattern.compile("^[0-9A-Za-zpxrm.,()%\\s#-]{1,120}$");
    public static final Pattern TEXT_INDENT_PATTERN = Pattern.compile("^((-?\\d+(?:\\.\\d+)?)(px|rem|em|%)|0)$");

    private static final int MAX_CUSTOM_PALETTE_COLORS = 24;
    private static final int MAX_TYPOGRAPHY_PRESETS = 40;

    private static final Set<String> COLOR_KEYS = Set.of(
            "primary", "secondary", "background", "surface", "text", "muted", "accent", "border"
    );
    private static final Set<String> REQUIRED_COLORS = Set.of("primary", "background", "text");

    public static final Set<String> ALLOWED_FONT_ROLES = Set.of(
            "primary", "secondary", "heading", "body", "monospace"
    );

    public static final Set<String> ALLOWED_FONT_SOURCES = Set.of("google", "system", "custom");

    public static final Set<String> DEFAULT_PRESET_IDS = Set.of(
            "h1", "h2", "h3", "h4", "h5", "h6",
            "body_large", "body", "body_small", "caption", "overline",
            "link", "button", "label"
    );

    public static final Set<String> ALLOWED_PRESET_CATEGORIES = Set.of(
            "headings", "body", "interactive", "custom"
    );

    public static final Set<String> ALLOWED_BUILTIN_FONTS = Set.of(
            "Inter", "Plus Jakarta Sans", "DM Sans", "Poppins", "Montserrat", "Manrope",
            "Outfit", "Work Sans", "Lato", "Open Sans", "Roboto", "Nunito",
            "Source Sans 3", "Rubik", "Space Grotesk", "Syne", "Sora", "Urbanist",
            "Figtree", "Geist",
            "Playfair Display", "Cormorant Garamond", "Fraunces", "Lora", "Merriweather",
            "Libre Baskerville", "DM Serif Display", "Bodoni Moda", "EB Garamond",
            "Crimson Pro", "Georgia", "Times New Roman",
            "JetBrains Mono", "Fira Code", "IBM Plex Mono", "Space Mono", "Source Code Pro",
            "System UI", "Arial", "Helvetica", "Verdana", "Trebuchet MS", "Courier New"
    );

    public static final Set<String> ALLOWED_PRESET_PROPERTIES = Set.of(
            "name", "category", "fontFamily", "fontSize", "fluidSize", "useFluid",
            "fontWeight", "fontStyle", "fontStretch", "color",
            "textTransform", "textDecoration", "textAlign",
            "lineHeight", "letterSpacing", "wordSpacing",
            "textShadow", "textIndent", "textWrap", "textOverflow"
    );

    public static Map<String, Object> defaultTokens() {
        Map<String, Object> colors = new LinkedHashMap<>();
        colors.put("primary", "#5B46E8");
        colors.put("secondary", "#1F2937");
        colors.put("background", "#FFFFFF");
        colors.put("surface", "#F8FAFC");
        colors.put("text", "#111318");
        colors.put("muted", "#5C6270");
        colors.put("accent", "#18794E");
        colors.put("border", "#E5E7EB");

        Map<String, Object> typography = new LinkedHashMap<>();
        typography.put("headingFont", "Georgia");
        typography.put("bodyFont", "Inter");

        Map<String, Object> radius = new LinkedHashMap<>();
        radius.put("card", "10px");
        radius.put("button", "8px");

        Map<String, Object> container = new LinkedHashMap<>();
        container.put("maxWidth", "1280px");

        Map<String, Object> spacing = new LinkedHashMap<>();
        spacing.put("sectionY", "64px");
        spacing.put("blockGap", "24px");

        Map<String, Object> shadows = new LinkedHashMap<>();
        shadows.put("card", "0 1px 3px rgba(15, 23, 42, 0.08)");
        shadows.put("elevated", "0 12px 32px rgba(15, 23, 42, 0.14)");

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("version", 1);
        root.put("colors", colors);
        root.put("typography", typography);
        root.put("radius", radius);
        root.put("container", container);
        root.put("spacing", spacing);
        root.put("shadows", shadows);
        return root;
    }

    public Map<String, Object> validateAndNormalize(Map<String, Object> rawTokens) {
        if (rawTokens == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Theme tokens payload is required");
        }
        BlockSchemaValidator.assertSafeRecursive(rawTokens, "tokens");

        Map<String, Object> defaults = defaultTokens();
        Map<String, Object> out = new LinkedHashMap<>();
        int version = rawTokens.get("version") instanceof Number n && n.intValue() == 2 ? 2 : 1;
        out.put("version", version);

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
        out.put("typography", validateAndNormalizeTypography(rawTokens.get("typography"), defaults));

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

        @SuppressWarnings("unchecked")
        Map<String, Object> container = new LinkedHashMap<>((Map<String, Object>) defaults.get("container"));
        if (rawTokens.get("container") instanceof Map<?, ?> rawContainer && rawContainer.get("maxWidth") != null) {
            container.put("maxWidth", validatePxRange(String.valueOf(rawContainer.get("maxWidth")), 1024, 1536, "container.maxWidth"));
        }
        out.put("container", container);

        if (rawTokens.get("spacing") instanceof Map<?, ?> rawSpacing) {
            Map<String, Object> spacing = new LinkedHashMap<>();
            if (rawSpacing.get("sectionY") != null) {
                spacing.put("sectionY", validatePxRange(String.valueOf(rawSpacing.get("sectionY")), 16, 160, "spacing.sectionY"));
            }
            if (rawSpacing.get("blockGap") != null) {
                spacing.put("blockGap", validatePxRange(String.valueOf(rawSpacing.get("blockGap")), 8, 96, "spacing.blockGap"));
            }
            if (!spacing.isEmpty()) {
                out.put("spacing", spacing);
            }
        }

        if (rawTokens.get("shadows") instanceof Map<?, ?> rawShadows) {
            Map<String, Object> shadows = new LinkedHashMap<>();
            for (String key : Set.of("card", "elevated")) {
                if (rawShadows.get(key) != null) {
                    String val = String.valueOf(rawShadows.get(key)).trim();
                    if (!val.isEmpty()) {
                        if (!SAFE_SHADOW.matcher(val).matches()) {
                            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid box-shadow value for shadows." + key);
                        }
                        shadows.put(key, val);
                    }
                }
            }
            if (!shadows.isEmpty()) {
                out.put("shadows", shadows);
            }
        }

        if (rawTokens.containsKey("customPalette")) {
            Object rawPaletteObj = rawTokens.get("customPalette");
            if (rawPaletteObj instanceof List<?> rawList) {
                if (rawList.size() > MAX_CUSTOM_PALETTE_COLORS) {
                    throw new ApiException(
                            ErrorCode.VALIDATION_ERROR,
                            "customPalette cannot contain more than " + MAX_CUSTOM_PALETTE_COLORS + " colors"
                    );
                }
                List<Map<String, Object>> normalizedPalette = new ArrayList<>();
                Set<String> seenIds = new HashSet<>();
                for (Object itemObj : rawList) {
                    if (!(itemObj instanceof Map<?, ?> itemMap)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Each customPalette entry must be an object");
                    }
                    String name = itemMap.get("name") == null ? "" : String.valueOf(itemMap.get("name")).trim();
                    if (name.isEmpty() || name.length() > 32) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Palette color name must be 1 to 32 characters");
                    }
                    String hex = itemMap.get("hex") == null ? "" : String.valueOf(itemMap.get("hex")).trim();
                    if (!HEX_COLOR.matcher(hex).matches()) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Palette color '" + name + "' must be a 6-digit hex code");
                    }
                    String rawId = itemMap.get("id") == null ? "" : String.valueOf(itemMap.get("id")).trim();
                    String baseId = rawId.isEmpty() ? slugifyPaletteId(name) : rawId;
                    if (!SAFE_PALETTE_ID.matcher(baseId).matches()) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid customPalette id: " + baseId);
                    }
                    String uniqueId = ensureUniqueId(baseId, seenIds);
                    seenIds.add(uniqueId);

                    Map<String, Object> cleanEntry = new LinkedHashMap<>();
                    cleanEntry.put("id", uniqueId);
                    cleanEntry.put("name", name);
                    cleanEntry.put("hex", hex.toUpperCase(Locale.ROOT));
                    normalizedPalette.add(cleanEntry);
                }
                out.put("customPalette", normalizedPalette);
            } else {
                out.put("customPalette", List.of());
            }
        }

        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> validateAndNormalizeTypography(Object rawTypoObj, Map<String, Object> defaults) {
        Map<String, Object> typography = new LinkedHashMap<>((Map<String, Object>) defaults.get("typography"));
        if (!(rawTypoObj instanceof Map<?, ?> rawTypo)) {
            return typography;
        }

        if (rawTypo.get("schemaVersion") instanceof Number sv && sv.intValue() >= 1) {
            typography.put("schemaVersion", Math.min(sv.intValue(), 10));
        }

        Set<String> customFontFamilies = new HashSet<>();
        Map<String, Object> normalizedFonts = null;
        if (rawTypo.get("fonts") instanceof Map<?, ?> rawFonts) {
            normalizedFonts = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : rawFonts.entrySet()) {
                String role = String.valueOf(entry.getKey()).trim();
                if (!ALLOWED_FONT_ROLES.contains(role)) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported typography font role: " + role);
                }
                if (!(entry.getValue() instanceof Map<?, ?> rawFontCfg)) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "typography.fonts." + role + " must be an object");
                }
                Map<String, Object> cleanCfg = normalizeFontConfig(rawFontCfg, role);
                if ("custom".equals(cleanCfg.get("source"))) {
                    customFontFamilies.add(String.valueOf(cleanCfg.get("family")));
                }
                normalizedFonts.put(role, cleanCfg);
            }
            typography.put("fonts", normalizedFonts);
        }

        for (String key : Set.of("headingFont", "bodyFont")) {
            if (rawTypo.get(key) != null) {
                String font = String.valueOf(rawTypo.get(key)).trim();
                if (!ALLOWED_BUILTIN_FONTS.contains(font) && !customFontFamilies.contains(font)) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported font for " + key + ": " + font);
                }
                typography.put(key, font);
            }
        }
        if (normalizedFonts != null) {
            if (normalizedFonts.get("heading") instanceof Map<?, ?> hf && hf.get("family") instanceof String f) {
                typography.put("headingFont", f);
            }
            if (normalizedFonts.get("body") instanceof Map<?, ?> bf && bf.get("family") instanceof String f) {
                typography.put("bodyFont", f);
            }
        }

        if (rawTypo.get("presets") instanceof Map<?, ?> rawPresets) {
            if (rawPresets.size() > MAX_TYPOGRAPHY_PRESETS) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Cannot define more than " + MAX_TYPOGRAPHY_PRESETS + " typography presets"
                );
            }
            Map<String, Object> normalizedPresets = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : rawPresets.entrySet()) {
                String presetId = String.valueOf(entry.getKey()).trim().toLowerCase(Locale.ROOT);
                if (!SAFE_PRESET_ID.matcher(presetId).matches()) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid typography preset id: " + presetId);
                }
                if (!(entry.getValue() instanceof Map<?, ?> rawPreset)) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "typography.presets." + presetId + " must be an object");
                }
                normalizedPresets.put(presetId, normalizePreset(presetId, rawPreset, customFontFamilies));
            }
            typography.put("presets", normalizedPresets);
        }

        return typography;
    }

    public static Map<String, Object> normalizeFontConfig(Map<?, ?> rawFontCfg, String role) {
        String source = rawFontCfg.get("source") != null
                ? String.valueOf(rawFontCfg.get("source")).trim().toLowerCase(Locale.ROOT)
                : "google";
        if (!ALLOWED_FONT_SOURCES.contains(source)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported font source '" + source + "' for " + role);
        }

        String family = rawFontCfg.get("family") != null ? String.valueOf(rawFontCfg.get("family")).trim() : "";
        if (!StringUtils.hasText(family)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "typography.fonts." + role + ".family is required");
        }
        if ("custom".equals(source)) {
            if (!SAFE_CUSTOM_FONT_NAME.matcher(family).matches()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid custom font family name: " + family);
            }
        } else if (!ALLOWED_BUILTIN_FONTS.contains(family)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported font for " + role + ": " + family);
        }

        Map<String, Object> clean = new LinkedHashMap<>();
        clean.put("family", family);
        clean.put("source", source);

        if (rawFontCfg.get("weights") instanceof List<?> rawWeights && !rawWeights.isEmpty()) {
            List<Integer> weights = new ArrayList<>();
            for (Object w : rawWeights) {
                int weight = parseFontWeightInt(w, "typography.fonts." + role + ".weights");
                if (!weights.contains(weight)) {
                    weights.add(weight);
                }
            }
            clean.put("weights", weights.size() > 9 ? weights.subList(0, 9) : weights);
        } else {
            clean.put("weights", List.of(400, 500, 600, 700));
        }

        String style = rawFontCfg.get("style") != null
                ? String.valueOf(rawFontCfg.get("style")).trim().toLowerCase(Locale.ROOT)
                : "normal";
        if (!Set.of("normal", "italic").contains(style)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Font style must be normal or italic");
        }
        clean.put("style", style);

        String fallback = rawFontCfg.get("fallback") != null
                ? String.valueOf(rawFontCfg.get("fallback")).trim()
                : ("monospace".equals(role) ? "monospace" : "sans-serif");
        if (!SAFE_FALLBACK.matcher(fallback).matches()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid font fallback stack for " + role);
        }
        clean.put("fallback", fallback);

        if ("custom".equals(source) && rawFontCfg.get("url") != null) {
            String url = String.valueOf(rawFontCfg.get("url")).trim();
            if (!url.isEmpty()) {
                String lowerUrl = url.toLowerCase(Locale.ROOT);
                if (!url.startsWith("/storage/") || url.contains("..")
                        || !(lowerUrl.endsWith(".woff2") || lowerUrl.endsWith(".woff") || lowerUrl.endsWith(".ttf"))) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Custom font URL must reference an uploaded .woff2, .woff, or .ttf asset under /storage/");
                }
                clean.put("url", url);
            }
        }
        if (rawFontCfg.get("format") != null) {
            String fmt = String.valueOf(rawFontCfg.get("format")).trim().toLowerCase(Locale.ROOT);
            if (Set.of("woff2", "woff", "truetype").contains(fmt)) {
                clean.put("format", fmt);
            }
        }
        if (rawFontCfg.get("variable") instanceof Boolean v) {
            clean.put("variable", v);
        }
        return clean;
    }

    private static Map<String, Object> normalizePreset(
            String presetId,
            Map<?, ?> rawPreset,
            Set<String> customFonts
    ) {
        Map<String, Object> clean = new LinkedHashMap<>();
        clean.put("id", presetId);

        String name = rawPreset.get("name") != null ? String.valueOf(rawPreset.get("name")).trim() : presetId;
        if (name.isEmpty() || name.length() > 60) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Preset '" + presetId + "' name must be 1 to 60 characters");
        }
        clean.put("name", name);

        String category = rawPreset.get("category") != null
                ? String.valueOf(rawPreset.get("category")).trim().toLowerCase(Locale.ROOT)
                : (presetId.startsWith("h") ? "headings" : "custom");
        if (!ALLOWED_PRESET_CATEGORIES.contains(category)) {
            category = "custom";
        }
        clean.put("category", category);
        clean.put("builtIn", rawPreset.get("builtIn") instanceof Boolean b ? b : DEFAULT_PRESET_IDS.contains(presetId));

        for (String prop : ALLOWED_PRESET_PROPERTIES) {
            if ("name".equals(prop) || "category".equals(prop) || !rawPreset.containsKey(prop) || rawPreset.get(prop) == null) {
                continue;
            }
            Object validated = validatePresetPropertyValue(prop, rawPreset.get(prop), customFonts, "presets." + presetId);
            if (validated != null) {
                clean.put(prop, validated);
            }
        }
        return clean;
    }

    public static Object validatePresetPropertyValue(
            String prop,
            Object rawVal,
            Set<String> customFonts,
            String context
    ) {
        if (rawVal == null) {
            return null;
        }
        return switch (prop) {
            case "name" -> {
                String n = String.valueOf(rawVal).trim();
                if (n.isEmpty() || n.length() > 60) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Preset name must be 1 to 60 characters in " + context);
                }
                yield n;
            }
            case "category" -> {
                String c = String.valueOf(rawVal).trim().toLowerCase(Locale.ROOT);
                yield ALLOWED_PRESET_CATEGORIES.contains(c) ? c : "custom";
            }
            case "fontFamily" -> validateFontReference(String.valueOf(rawVal), customFonts, context);
            case "fontSize", "lineHeight", "letterSpacing" -> validateResponsiveMetric(rawVal, prop, context);
            case "fluidSize" -> {
                String clampVal = String.valueOf(rawVal).trim();
                if (clampVal.isEmpty()) {
                    yield "";
                }
                if (!CLAMP_PATTERN.matcher(clampVal).matches()) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "fluidSize must be a valid CSS clamp(...) in " + context);
                }
                yield clampVal;
            }
            case "useFluid" -> Boolean.TRUE.equals(rawVal);
            case "fontWeight" -> parseFontWeightInt(rawVal, context + ".fontWeight");
            case "fontStyle" -> validateEnum(String.valueOf(rawVal), Set.of("normal", "italic", "oblique"), prop, context);
            case "fontStretch" -> validateEnum(String.valueOf(rawVal), Set.of("condensed", "semi-condensed", "normal", "semi-expanded", "expanded"), prop, context);
            case "color" -> {
                String color = String.valueOf(rawVal).trim();
                if (color.isEmpty()) {
                    yield "";
                }
                if (!HEX_COLOR.matcher(color).matches() && !CSS_VAR_COLOR.matcher(color).matches()) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "color must be #RRGGBB hex or var(--...) in " + context);
                }
                yield HEX_COLOR.matcher(color).matches() ? color.toUpperCase(Locale.ROOT) : color;
            }
            case "textTransform" -> validateEnum(String.valueOf(rawVal), Set.of("none", "uppercase", "lowercase", "capitalize"), prop, context);
            case "textDecoration" -> validateEnum(String.valueOf(rawVal), Set.of("none", "underline", "line-through"), prop, context);
            case "textAlign" -> validateEnum(String.valueOf(rawVal), Set.of("left", "center", "right", "justify"), prop, context);
            case "wordSpacing" -> {
                String ws = String.valueOf(rawVal).trim();
                if (ws.isEmpty() || "normal".equalsIgnoreCase(ws)) {
                    yield ws.isEmpty() ? "" : "normal";
                }
                if (!LETTER_SPACING_PATTERN.matcher(ws).matches()) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid wordSpacing in " + context);
                }
                yield ws;
            }
            case "textShadow" -> {
                String ts = String.valueOf(rawVal).trim();
                if (ts.isEmpty() || "none".equalsIgnoreCase(ts)) {
                    yield ts.isEmpty() ? "" : "none";
                }
                if (!SAFE_TEXT_SHADOW.matcher(ts).matches()) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid textShadow in " + context);
                }
                yield ts;
            }
            case "textIndent" -> {
                String ti = String.valueOf(rawVal).trim();
                if (ti.isEmpty()) {
                    yield "";
                }
                if (!TEXT_INDENT_PATTERN.matcher(ti).matches()) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid textIndent in " + context);
                }
                yield ti;
            }
            case "textWrap" -> validateEnum(String.valueOf(rawVal), Set.of("wrap", "nowrap", "balance", "pretty"), prop, context);
            case "textOverflow" -> validateEnum(String.valueOf(rawVal), Set.of("clip", "ellipsis"), prop, context);
            default -> throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported preset property: " + prop);
        };
    }

    public static String validateFontReference(String rawRef, Set<String> customFonts, String context) {
        String trimmed = rawRef == null ? "" : rawRef.trim();
        if (ALLOWED_FONT_ROLES.contains(trimmed)
                || ALLOWED_BUILTIN_FONTS.contains(trimmed)
                || (customFonts != null && customFonts.contains(trimmed))) {
            return trimmed;
        }
        throw new ApiException(
                ErrorCode.VALIDATION_ERROR,
                "Unsupported font family or role '" + trimmed + "' in " + context
        );
    }

    public static Object validateResponsiveMetric(Object rawMetric, String property, String context) {
        if (rawMetric instanceof Map<?, ?> rawMap) {
            Map<String, Object> clean = new LinkedHashMap<>();
            for (String bp : List.of("desktop", "tablet", "mobile")) {
                if (rawMap.get(bp) != null) {
                    clean.put(bp, validateSingleMetricValue(rawMap.get(bp), property, context + "." + bp));
                }
            }
            if (clean.isEmpty()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, property + " responsive map requires at least desktop value");
            }
            return clean;
        }
        return validateSingleMetricValue(rawMetric, property, context);
    }

    public static Object validateSingleMetricValue(Object rawVal, String property, String context) {
        if ("lineHeight".equals(property)) {
            if (rawVal instanceof Number num) {
                double d = num.doubleValue();
                if (d < 0.8 || d > 3.5) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "lineHeight must be between 0.8 and 3.5 in " + context);
                }
                return d;
            }
            String s = String.valueOf(rawVal).trim();
            Matcher m = LINE_HEIGHT_PATTERN.matcher(s);
            if (!m.matches()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid lineHeight value '" + s + "' in " + context);
            }
            double val = Double.parseDouble(m.group(1));
            String unit = m.group(2);
            if (unit == null) {
                if (val < 0.8 || val > 3.5) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unitless lineHeight must be between 0.8 and 3.5 in " + context);
                }
                return val;
            }
            if ("px".equals(unit) && (val < 10 || val > 220)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "lineHeight px must be between 10px and 220px in " + context);
            }
            return s;
        }

        if ("fontSize".equals(property)) {
            String s = String.valueOf(rawVal).trim();
            if (CLAMP_PATTERN.matcher(s).matches()) {
                return s;
            }
            Matcher m = SIZE_UNIT_PATTERN.matcher(s);
            if (!m.matches()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "fontSize must use px, rem, em, or clamp(...) in " + context);
            }
            double val = Double.parseDouble(m.group(1));
            String unit = m.group(2);
            if ("px".equals(unit) && (val < 8 || val > 180)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "fontSize in px must be between 8px and 180px in " + context);
            }
            if (("rem".equals(unit) || "em".equals(unit)) && (val < 0.5 || val > 12.0)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "fontSize in " + unit + " must be between 0.5 and 12 in " + context);
            }
            return s;
        }

        if ("letterSpacing".equals(property)) {
            String s = String.valueOf(rawVal).trim();
            if ("normal".equalsIgnoreCase(s)) {
                return "normal";
            }
            Matcher m = LETTER_SPACING_PATTERN.matcher(s);
            if (!m.matches()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "letterSpacing must use px, rem, em, or 0 in " + context);
            }
            return s;
        }

        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported metric property: " + property);
    }

    public static int parseFontWeightInt(Object raw, String context) {
        int val;
        if (raw instanceof Number n) {
            val = n.intValue();
        } else {
            try {
                val = Integer.parseInt(String.valueOf(raw).trim());
            } catch (NumberFormatException ex) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid fontWeight in " + context);
            }
        }
        if (val < 100 || val > 900 || val % 100 != 0) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "fontWeight must be a multiple of 100 between 100 and 900 in " + context);
        }
        return val;
    }

    public static String validateEnum(String raw, Set<String> allowed, String field, String context) {
        String clean = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (!allowed.contains(clean)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported " + field + " value '" + clean + "' in " + context);
        }
        return clean;
    }

    private static String slugifyPaletteId(String name) {
        String slug = name.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9_-]+", "-")
                .replaceAll("^-+|-+$", "");
        if (slug.isEmpty()) {
            slug = "swatch";
        }
        return slug.length() > 32 ? slug.substring(0, 32) : slug;
    }

    private static String ensureUniqueId(String baseId, Set<String> seenIds) {
        if (!seenIds.contains(baseId)) {
            return baseId;
        }
        int suffix = 2;
        while (true) {
            String candidate = baseId + "-" + suffix;
            if (candidate.length() > 40) {
                int keep = Math.max(1, 40 - ("-" + suffix).length());
                candidate = baseId.substring(0, keep) + "-" + suffix;
            }
            if (!seenIds.contains(candidate)) {
                return candidate;
            }
            suffix++;
        }
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
        return trimmed;
    }
}
