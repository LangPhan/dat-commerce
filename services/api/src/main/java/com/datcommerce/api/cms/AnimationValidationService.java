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
public class AnimationValidationService {

    public static final Set<String> ALLOWED_CATEGORIES = Set.of(
            "entrance", "scroll", "hover", "interaction", "continuous", "text", "custom"
    );

    public static final Set<String> ENTRANCE_PRESETS = Set.of(
            "none",
            "fadeIn", "fadeInUp", "fadeInDown", "fadeInLeft", "fadeInRight",
            "slideInUp", "slideInDown", "slideInLeft", "slideInRight",
            "zoomIn", "zoomInUp", "zoomInDown", "zoomInLeft", "zoomInRight",
            "bounceIn", "bounceInUp", "bounceInDown",
            "rotateIn", "rotateInUp", "rotateInDown",
            "flipInX", "flipInY", "backInUp", "backInDown", "lightSpeedIn"
    );

    public static final Set<String> SCROLL_MODES = Set.of("reveal", "linked", "parallax", "sticky");

    public static final Set<String> SCROLL_EFFECTS = Set.of(
            "none",
            "scrollFade", "scrollSlide", "scrollZoom",
            "revealTop", "revealBottom", "revealLeft", "revealRight",
            "translateX", "translateY", "scale", "rotate", "opacity", "blur", "skew",
            "parallaxVertical", "parallaxHorizontal", "parallaxBackground",
            "stickyScale", "stickyFade", "stickyTransform"
    );

    public static final Set<String> HOVER_PRESETS = Set.of(
            "none", "scaleUp", "scaleDown", "moveUp", "moveDown", "moveLeft", "moveRight",
            "rotate", "tilt", "fade", "shadow", "glow", "blur", "borderHighlight", "underlineReveal"
    );

    public static final Set<String> INTERACTION_PRESETS = Set.of(
            "none", "buttonPress", "clickScaleDown", "iconRotate",
            "accordionExpand", "toggleTransition", "modalEntrance"
    );

    public static final Set<String> INTERACTION_TRIGGERS = Set.of("click", "tap", "focus", "active", "toggle");

    public static final Set<String> CONTINUOUS_PRESETS = Set.of(
            "none", "floating", "pulse", "bounce", "swing", "shake",
            "rotate", "wobble", "breathing", "shimmer", "wave"
    );

    public static final Set<String> TEXT_PRESETS = Set.of(
            "none",
            "textFadeIn", "textSlideUp", "textSlideDown", "textBlurReveal",
            "staggerChar", "staggerWord", "staggerLine",
            "typingEffect", "textReveal", "gradientTextMove"
    );

    public static final Set<String> EASING_TOKENS = Set.of(
            "linear", "ease", "easeIn", "easeOut", "easeInOut", "spring", "custom"
    );

    public static final Set<String> DIRECTIONS = Set.of("normal", "reverse", "alternate", "alternate-reverse");
    public static final Set<String> ENTRANCE_TRIGGERS = Set.of("load", "viewport");
    public static final Set<String> STAGGER_ORDERS = Set.of("sequential", "row", "column");
    public static final Set<String> MOBILE_BEHAVIORS = Set.of("full", "reduced", "disabled");
    public static final Set<String> REDUCED_MOTION_POLICIES = Set.of("respect-system", "always-reduced", "essential-only");

    private static final Pattern SAFE_PRESET_KEY = Pattern.compile("^[a-zA-Z0-9_-]{1,80}$");
    private static final Pattern CUBIC_BEZIER = Pattern.compile(
            "^cubic-bezier\\(\\s*([0-9]*\\.?[0-9]+)\\s*,\\s*(-?[0-9]*\\.?[0-9]+)\\s*,\\s*([0-9]*\\.?[0-9]+)\\s*,\\s*(-?[0-9]*\\.?[0-9]+)\\s*\\)$"
    );
    private static final Pattern SAFE_SHADOW = Pattern.compile("^[a-zA-Z0-9#%.,()\\s-]{1,160}$");

    public static Map<String, Object> defaultGlobalMotion() {
        Map<String, Object> timingTokens = new LinkedHashMap<>();
        timingTokens.put("fast", 150);
        timingTokens.put("normal", 300);
        timingTokens.put("slow", 600);

        Map<String, Object> easingTokens = new LinkedHashMap<>();
        easingTokens.put("linear", "cubic-bezier(0, 0, 1, 1)");
        easingTokens.put("ease", "cubic-bezier(0.25, 0.1, 0.25, 1)");
        easingTokens.put("easeIn", "cubic-bezier(0.42, 0, 1, 1)");
        easingTokens.put("easeOut", "cubic-bezier(0, 0, 0.2, 1)");
        easingTokens.put("easeInOut", "cubic-bezier(0.4, 0, 0.2, 1)");
        easingTokens.put("custom", "cubic-bezier(0.22, 1, 0.36, 1)");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemaVersion", 1);
        out.put("enabled", true);
        out.put("scrollEffectsEnabled", true);
        out.put("hoverEffectsEnabled", true);
        out.put("mobileBehavior", "reduced");
        out.put("reducedMotionPolicy", "respect-system");
        out.put("defaultDuration", 300);
        out.put("defaultEasing", "easeOut");
        out.put("defaultHoverDuration", 220);
        out.put("defaultEntrancePreset", "fadeInUp");
        out.put("timingTokens", timingTokens);
        out.put("easingTokens", easingTokens);
        return out;
    }

    public Map<String, Object> validateAndNormalizeElementMotion(Object rawMotionObj, String path) {
        if (rawMotionObj == null) return null;
        if (!(rawMotionObj instanceof Map<?, ?> raw)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, path + " must be an object");
        }
        BlockSchemaValidator.assertSafeRecursive(raw, path);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemaVersion", 1);
        if (raw.containsKey("enabled") && raw.get("enabled") != null) {
            out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        }
        if (raw.get("presetRef") instanceof String ref && StringUtils.hasText(ref)) {
            String trimmed = ref.trim();
            if (!SAFE_PRESET_KEY.matcher(trimmed).matches()) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, path + ".presetRef has invalid characters");
            }
            out.put("presetRef", trimmed);
        }
        normalizeMotionSubConfigs(raw, out, path);

        if (raw.get("responsive") instanceof Map<?, ?> respRaw) {
            Map<String, Object> respOut = new LinkedHashMap<>();
            for (String bp : List.of("tablet", "mobile")) {
                if (respRaw.get(bp) instanceof Map<?, ?> bpMap) {
                    Map<String, Object> bpOut = new LinkedHashMap<>();
                    if (bpMap.containsKey("enabled") && bpMap.get("enabled") != null) {
                        bpOut.put("enabled", Boolean.TRUE.equals(bpMap.get("enabled")));
                    }
                    if (bpMap.get("presetRef") instanceof String ref && StringUtils.hasText(ref)) {
                        String trimmed = ref.trim();
                        if (!SAFE_PRESET_KEY.matcher(trimmed).matches()) {
                            throw new ApiException(ErrorCode.VALIDATION_ERROR, path + ".responsive." + bp + ".presetRef invalid");
                        }
                        bpOut.put("presetRef", trimmed);
                    }
                    normalizeMotionSubConfigs(bpMap, bpOut, path + ".responsive." + bp);
                    if (!bpOut.isEmpty()) respOut.put(bp, bpOut);
                }
            }
            if (!respOut.isEmpty()) out.put("responsive", respOut);
        }
        return out;
    }

    private void normalizeMotionSubConfigs(Map<?, ?> raw, Map<String, Object> out, String path) {
        if (raw.get("entrance") instanceof Map<?, ?> m) out.put("entrance", validateEntrance(m, path + ".entrance"));
        if (raw.get("scroll") instanceof Map<?, ?> m) out.put("scroll", validateScroll(m, path + ".scroll"));
        if (raw.get("hover") instanceof Map<?, ?> m) out.put("hover", validateHover(m, path + ".hover"));
        if (raw.get("interaction") instanceof Map<?, ?> m) out.put("interaction", validateInteraction(m, path + ".interaction"));
        if (raw.get("continuous") instanceof Map<?, ?> m) out.put("continuous", validateContinuous(m, path + ".continuous"));
        if (raw.get("text") instanceof Map<?, ?> m) out.put("text", validateText(m, path + ".text"));
        if (raw.get("stagger") instanceof Map<?, ?> m) out.put("stagger", validateStagger(m, path + ".stagger"));
    }

    public Map<String, Object> validateEntrance(Map<?, ?> raw, String path) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.get("preset") != null) {
            String preset = str(raw.get("preset"));
            if (!ENTRANCE_PRESETS.contains(preset)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported entrance preset at " + path + ": " + preset);
            }
            out.put("preset", preset);
        }
        if (raw.get("trigger") != null) {
            String trigger = str(raw.get("trigger")).toLowerCase(Locale.ROOT);
            if (!ENTRANCE_TRIGGERS.contains(trigger)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid trigger at " + path);
            out.put("trigger", trigger);
        }
        if (raw.get("duration") != null) out.put("duration", intRange(raw.get("duration"), 0, 5000, path + ".duration"));
        if (raw.get("delay") != null) out.put("delay", intRange(raw.get("delay"), 0, 5000, path + ".delay"));
        if (raw.get("easing") != null) out.put("easing", validateEasing(raw.get("easing"), path + ".easing"));
        if (raw.get("repeat") != null) out.put("repeat", intRange(raw.get("repeat"), 1, 100, path + ".repeat"));
        if (raw.get("repeatDelay") != null) out.put("repeatDelay", intRange(raw.get("repeatDelay"), 0, 10000, path + ".repeatDelay"));
        if (raw.get("direction") != null) {
            String dir = str(raw.get("direction")).toLowerCase(Locale.ROOT);
            if (!DIRECTIONS.contains(dir)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid direction at " + path);
            out.put("direction", dir);
        }
        if (raw.get("threshold") != null) out.put("threshold", doubleRange(raw.get("threshold"), 0.0, 1.0, path + ".threshold"));
        if (raw.get("distance") != null) out.put("distance", intRange(raw.get("distance"), 0, 300, path + ".distance"));
        if (raw.containsKey("once") && raw.get("once") != null) out.put("once", Boolean.TRUE.equals(raw.get("once")));
        return out;
    }

    public Map<String, Object> validateScroll(Map<?, ?> raw, String path) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.get("mode") != null) {
            String mode = str(raw.get("mode")).toLowerCase(Locale.ROOT);
            if (!SCROLL_MODES.contains(mode)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid scroll mode at " + path);
            out.put("mode", mode);
        }
        Object rawEff = raw.get("effect") != null ? raw.get("effect") : raw.get("preset");
        if (rawEff != null) {
            String eff = str(rawEff);
            if (!SCROLL_EFFECTS.contains(eff)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported scroll effect at " + path + ": " + eff);
            out.put("effect", eff);
        }
        if (raw.get("start") != null) out.put("start", intRange(raw.get("start"), 0, 100, path + ".start"));
        if (raw.get("end") != null) out.put("end", intRange(raw.get("end"), 0, 100, path + ".end"));
        if (raw.get("direction") != null) {
            String dir = str(raw.get("direction")).toLowerCase(Locale.ROOT);
            if (!Set.of("normal", "reverse", "up", "down", "left", "right").contains(dir)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid scroll direction at " + path);
            }
            out.put("direction", dir);
        }
        if (raw.get("min") != null) out.put("min", doubleRange(raw.get("min"), -2000, 2000, path + ".min"));
        if (raw.get("max") != null) out.put("max", doubleRange(raw.get("max"), -2000, 2000, path + ".max"));
        if (raw.get("speed") != null) out.put("speed", doubleRange(raw.get("speed"), -200, 200, path + ".speed"));
        if (raw.get("intensity") != null) out.put("intensity", doubleRange(raw.get("intensity"), 0, 200, path + ".intensity"));
        if (raw.get("offset") != null) out.put("offset", intRange(raw.get("offset"), -500, 500, path + ".offset"));
        if (raw.get("stickyOffset") != null) out.put("stickyOffset", intRange(raw.get("stickyOffset"), 0, 400, path + ".stickyOffset"));
        if (raw.get("stickyDuration") != null) out.put("stickyDuration", intRange(raw.get("stickyDuration"), 100, 3000, path + ".stickyDuration"));
        if (raw.get("duration") != null) out.put("duration", intRange(raw.get("duration"), 0, 5000, path + ".duration"));
        if (raw.get("easing") != null) out.put("easing", validateEasing(raw.get("easing"), path + ".easing"));
        return out;
    }

    public Map<String, Object> validateHover(Map<?, ?> raw, String path) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.get("preset") != null) {
            String preset = str(raw.get("preset"));
            if (!HOVER_PRESETS.contains(preset)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported hover preset at " + path + ": " + preset);
            out.put("preset", preset);
        }
        if (raw.get("scale") != null) out.put("scale", doubleRange(raw.get("scale"), 0.2, 3.0, path + ".scale"));
        if (raw.get("translateX") != null) out.put("translateX", intRange(raw.get("translateX"), -200, 200, path + ".translateX"));
        if (raw.get("translateY") != null) out.put("translateY", intRange(raw.get("translateY"), -200, 200, path + ".translateY"));
        if (raw.get("rotate") != null) out.put("rotate", doubleRange(raw.get("rotate"), -720, 720, path + ".rotate"));
        if (raw.get("opacity") != null) out.put("opacity", doubleRange(raw.get("opacity"), 0.0, 1.0, path + ".opacity"));
        if (raw.get("blur") != null) out.put("blur", doubleRange(raw.get("blur"), 0.0, 40.0, path + ".blur"));
        if (raw.get("shadow") != null) {
            String sh = str(raw.get("shadow"));
            if (!sh.isEmpty()) {
                if (!SAFE_SHADOW.matcher(sh).matches()) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsafe shadow value at " + path + ".shadow");
                out.put("shadow", sh);
            }
        }
        if (raw.get("duration") != null) out.put("duration", intRange(raw.get("duration"), 0, 5000, path + ".duration"));
        if (raw.get("delay") != null) out.put("delay", intRange(raw.get("delay"), 0, 5000, path + ".delay"));
        if (raw.get("easing") != null) out.put("easing", validateEasing(raw.get("easing"), path + ".easing"));
        return out;
    }

    public Map<String, Object> validateInteraction(Map<?, ?> raw, String path) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.get("preset") != null) {
            String preset = str(raw.get("preset"));
            if (!INTERACTION_PRESETS.contains(preset)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported interaction preset at " + path + ": " + preset);
            out.put("preset", preset);
        }
        if (raw.get("trigger") != null) {
            String trigger = str(raw.get("trigger")).toLowerCase(Locale.ROOT);
            if (!INTERACTION_TRIGGERS.contains(trigger)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported interaction trigger at " + path);
            out.put("trigger", trigger);
        }
        if (raw.get("triggers") instanceof List<?> list) {
            List<String> clean = new ArrayList<>();
            for (Object item : list) {
                String t = str(item).toLowerCase(Locale.ROOT);
                if (!INTERACTION_TRIGGERS.contains(t)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported interaction trigger at " + path);
                if (!clean.contains(t)) clean.add(t);
            }
            out.put("triggers", clean);
        }
        if (raw.get("scale") != null) out.put("scale", doubleRange(raw.get("scale"), 0.5, 2.0, path + ".scale"));
        if (raw.get("rotate") != null) out.put("rotate", doubleRange(raw.get("rotate"), -360, 360, path + ".rotate"));
        if (raw.get("duration") != null) out.put("duration", intRange(raw.get("duration"), 0, 3000, path + ".duration"));
        if (raw.get("easing") != null) out.put("easing", validateEasing(raw.get("easing"), path + ".easing"));
        return out;
    }

    public Map<String, Object> validateContinuous(Map<?, ?> raw, String path) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.get("preset") != null) {
            String preset = str(raw.get("preset"));
            if (!CONTINUOUS_PRESETS.contains(preset)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported continuous preset at " + path + ": " + preset);
            out.put("preset", preset);
        }
        if (raw.get("duration") != null) out.put("duration", intRange(raw.get("duration"), 100, 15000, path + ".duration"));
        if (raw.get("delay") != null) out.put("delay", intRange(raw.get("delay"), 0, 5000, path + ".delay"));
        if (raw.get("repeat") != null) out.put("repeat", intRange(raw.get("repeat"), 1, 100, path + ".repeat"));
        if (raw.containsKey("infinite") && raw.get("infinite") != null) out.put("infinite", Boolean.TRUE.equals(raw.get("infinite")));
        if (raw.get("direction") != null) {
            String dir = str(raw.get("direction")).toLowerCase(Locale.ROOT);
            if (!DIRECTIONS.contains(dir)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid continuous direction at " + path);
            out.put("direction", dir);
        }
        if (raw.get("easing") != null) out.put("easing", validateEasing(raw.get("easing"), path + ".easing"));
        if (raw.containsKey("pauseOnHover") && raw.get("pauseOnHover") != null) out.put("pauseOnHover", Boolean.TRUE.equals(raw.get("pauseOnHover")));
        return out;
    }

    public Map<String, Object> validateText(Map<?, ?> raw, String path) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.get("preset") != null) {
            String preset = str(raw.get("preset"));
            if (!TEXT_PRESETS.contains(preset)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported text animation preset at " + path + ": " + preset);
            out.put("preset", preset);
        }
        if (raw.get("splitBy") != null) {
            String split = str(raw.get("splitBy")).toLowerCase(Locale.ROOT);
            if (!Set.of("char", "word", "line").contains(split)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid text splitBy at " + path);
            out.put("splitBy", split);
        }
        if (raw.get("staggerMs") != null) out.put("staggerMs", intRange(raw.get("staggerMs"), 0, 500, path + ".staggerMs"));
        if (raw.get("duration") != null) out.put("duration", intRange(raw.get("duration"), 50, 5000, path + ".duration"));
        if (raw.get("delay") != null) out.put("delay", intRange(raw.get("delay"), 0, 5000, path + ".delay"));
        if (raw.get("easing") != null) out.put("easing", validateEasing(raw.get("easing"), path + ".easing"));
        if (raw.get("trigger") != null) {
            String trigger = str(raw.get("trigger")).toLowerCase(Locale.ROOT);
            if (!ENTRANCE_TRIGGERS.contains(trigger)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid text trigger at " + path);
            out.put("trigger", trigger);
        }
        return out;
    }

    public Map<String, Object> validateStagger(Map<?, ?> raw, String path) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.get("preset") != null) {
            String preset = str(raw.get("preset"));
            if (!ENTRANCE_PRESETS.contains(preset)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported stagger preset at " + path + ": " + preset);
            out.put("preset", preset);
        }
        if (raw.get("initialDelay") != null) out.put("initialDelay", intRange(raw.get("initialDelay"), 0, 3000, path + ".initialDelay"));
        if (raw.get("interval") != null) out.put("interval", intRange(raw.get("interval"), 0, 500, path + ".interval"));
        if (raw.get("maxDelay") != null) out.put("maxDelay", intRange(raw.get("maxDelay"), 0, 3000, path + ".maxDelay"));
        if (raw.get("duration") != null) out.put("duration", intRange(raw.get("duration"), 50, 3000, path + ".duration"));
        if (raw.get("direction") != null) {
            String dir = str(raw.get("direction")).toLowerCase(Locale.ROOT);
            if (!Set.of("forward", "reverse", "center").contains(dir)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid stagger direction at " + path);
            out.put("direction", dir);
        }
        if (raw.get("order") != null) {
            String order = str(raw.get("order")).toLowerCase(Locale.ROOT);
            if (!STAGGER_ORDERS.contains(order)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid stagger order at " + path);
            out.put("order", order);
        }
        if (raw.get("trigger") != null) {
            String trigger = str(raw.get("trigger")).toLowerCase(Locale.ROOT);
            if (!ENTRANCE_TRIGGERS.contains(trigger)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid stagger trigger at " + path);
            out.put("trigger", trigger);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> validateAndNormalizeGlobalMotion(Object rawObj) {
        Map<String, Object> out = defaultGlobalMotion();
        if (rawObj == null) return out;
        if (!(rawObj instanceof Map<?, ?> raw)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "tokens.motion must be an object");
        }
        BlockSchemaValidator.assertSafeRecursive(raw, "tokens.motion");

        if (raw.containsKey("enabled") && raw.get("enabled") != null) out.put("enabled", Boolean.TRUE.equals(raw.get("enabled")));
        if (raw.containsKey("scrollEffectsEnabled") && raw.get("scrollEffectsEnabled") != null) out.put("scrollEffectsEnabled", Boolean.TRUE.equals(raw.get("scrollEffectsEnabled")));
        if (raw.containsKey("hoverEffectsEnabled") && raw.get("hoverEffectsEnabled") != null) out.put("hoverEffectsEnabled", Boolean.TRUE.equals(raw.get("hoverEffectsEnabled")));
        if (raw.get("mobileBehavior") != null) {
            String mb = str(raw.get("mobileBehavior")).toLowerCase(Locale.ROOT);
            if (!MOBILE_BEHAVIORS.contains(mb)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid tokens.motion.mobileBehavior: " + mb);
            out.put("mobileBehavior", mb);
        }
        if (raw.get("reducedMotionPolicy") != null) {
            String rp = str(raw.get("reducedMotionPolicy")).toLowerCase(Locale.ROOT);
            if (!REDUCED_MOTION_POLICIES.contains(rp)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid tokens.motion.reducedMotionPolicy: " + rp);
            out.put("reducedMotionPolicy", rp);
        }
        if (raw.get("defaultDuration") != null) out.put("defaultDuration", intRange(raw.get("defaultDuration"), 50, 3000, "tokens.motion.defaultDuration"));
        if (raw.get("defaultHoverDuration") != null) out.put("defaultHoverDuration", intRange(raw.get("defaultHoverDuration"), 50, 2000, "tokens.motion.defaultHoverDuration"));
        if (raw.get("defaultEasing") != null) out.put("defaultEasing", validateEasing(raw.get("defaultEasing"), "tokens.motion.defaultEasing"));
        if (raw.get("defaultEntrancePreset") != null) {
            String preset = str(raw.get("defaultEntrancePreset"));
            if (!ENTRANCE_PRESETS.contains(preset)) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported tokens.motion.defaultEntrancePreset: " + preset);
            out.put("defaultEntrancePreset", preset);
        }
        if (raw.get("timingTokens") instanceof Map<?, ?> tt) {
            Map<String, Object> tokens = new LinkedHashMap<>((Map<String, Object>) out.get("timingTokens"));
            for (String k : List.of("fast", "normal", "slow")) {
                if (tt.get(k) != null) tokens.put(k, intRange(tt.get(k), 50, 3000, "tokens.motion.timingTokens." + k));
            }
            out.put("timingTokens", tokens);
        }
        if (raw.get("easingTokens") instanceof Map<?, ?> et) {
            Map<String, Object> easings = new LinkedHashMap<>((Map<String, Object>) out.get("easingTokens"));
            for (String k : List.of("linear", "ease", "easeIn", "easeOut", "easeInOut", "custom")) {
                if (et.get(k) != null) easings.put(k, validateCubicBezierOrKeyword(et.get(k), "tokens.motion.easingTokens." + k));
            }
            out.put("easingTokens", easings);
        }
        return out;
    }

    public Map<String, Object> validatePresetConfig(String category, Map<String, Object> rawConfig) {
        String cat = str(category).toLowerCase(Locale.ROOT);
        if (!ALLOWED_CATEGORIES.contains(cat)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Unsupported animation preset category: " + category);
        }
        if (rawConfig == null || rawConfig.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Animation preset configuration is required");
        }
        return validateAndNormalizeElementMotion(rawConfig, "preset.config");
    }

    public String validateEasing(Object val, String path) {
        String s = str(val);
        if (EASING_TOKENS.contains(s)) return s;
        return validateCubicBezierOrKeyword(s, path);
    }

    private String validateCubicBezierOrKeyword(Object val, String path) {
        String s = str(val);
        if (Set.of("linear", "ease", "ease-in", "ease-out", "ease-in-out").contains(s)) return s;
        Matcher m = CUBIC_BEZIER.matcher(s);
        if (!m.matches()) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid easing at " + path + ": " + s);
        double x1 = Double.parseDouble(m.group(1));
        double y1 = Double.parseDouble(m.group(2));
        double x2 = Double.parseDouble(m.group(3));
        double y2 = Double.parseDouble(m.group(4));
        if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1 || y1 < -5 || y1 > 5 || y2 < -5 || y2 > 5) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "cubic-bezier control points out of bounds at " + path);
        }
        return s;
    }

    private int intRange(Object raw, int min, int max, String path) {
        int iv = (int) Math.round(parseNumber(raw, path));
        if (iv < min || iv > max) throw new ApiException(ErrorCode.VALIDATION_ERROR, path + " must be between " + min + " and " + max);
        return iv;
    }

    private double doubleRange(Object raw, double min, double max, String path) {
        double d = parseNumber(raw, path);
        if (d < min || d > max) throw new ApiException(ErrorCode.VALIDATION_ERROR, path + " must be between " + min + " and " + max);
        return Math.round(d * 1000.0) / 1000.0;
    }

    private double parseNumber(Object raw, String path) {
        if (raw instanceof Number n) {
            double v = n.doubleValue();
            if (!Double.isFinite(v)) throw new ApiException(ErrorCode.VALIDATION_ERROR, path + " must be a finite number");
            return v;
        }
        try {
            double v = Double.parseDouble(String.valueOf(raw).trim());
            if (!Double.isFinite(v)) throw new ApiException(ErrorCode.VALIDATION_ERROR, path + " must be a finite number");
            return v;
        } catch (NumberFormatException ex) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, path + " must be a valid number");
        }
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
