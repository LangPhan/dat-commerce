package com.datcommerce.api.cms;

import static org.junit.jupiter.api.Assertions.*;

import com.datcommerce.api.common.exception.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AnimationValidationServiceTest {

    private final AnimationValidationService validator = new AnimationValidationService();
    private final BlockSchemaValidator blockValidator = new BlockSchemaValidator();
    private final ThemeTokenValidator themeValidator = new ThemeTokenValidator();

    @Test
    void validatesFullElementMotionWithAllCategoriesAndResponsiveOverrides() {
        Map<String, Object> raw = Map.of(
                "enabled", true,
                "presetRef", "hero-fade-up",
                "entrance", Map.of(
                        "enabled", true,
                        "preset", "fadeInUp",
                        "trigger", "viewport",
                        "duration", 600,
                        "delay", 100,
                        "easing", "cubic-bezier(0.22, 1, 0.36, 1)",
                        "repeat", 1,
                        "threshold", 0.25
                ),
                "scroll", Map.of(
                        "enabled", true,
                        "mode", "parallax",
                        "effect", "parallaxVertical",
                        "start", 10,
                        "end", 90,
                        "intensity", 35,
                        "speed", 25
                ),
                "hover", Map.of(
                        "enabled", true,
                        "preset", "scaleUp",
                        "scale", 1.04,
                        "translateY", -4,
                        "duration", 240,
                        "easing", "easeOut"
                ),
                "interaction", Map.of(
                        "enabled", true,
                        "preset", "buttonPress",
                        "triggers", List.of("click", "focus"),
                        "scale", 0.96,
                        "duration", 140
                ),
                "continuous", Map.of(
                        "enabled", false,
                        "preset", "floating",
                        "duration", 2400,
                        "infinite", true,
                        "pauseOnHover", true
                ),
                "text", Map.of(
                        "enabled", true,
                        "preset", "staggerWord",
                        "splitBy", "word",
                        "staggerMs", 60,
                        "duration", 450
                ),
                "stagger", Map.of(
                        "enabled", true,
                        "preset", "fadeInUp",
                        "initialDelay", 50,
                        "interval", 80,
                        "maxDelay", 600,
                        "order", "row"
                ),
                "responsive", Map.of(
                        "tablet", Map.of(
                                "entrance", Map.of("preset", "fadeIn", "duration", 400)
                        ),
                        "mobile", Map.of(
                                "enabled", true,
                                "scroll", Map.of("enabled", false),
                                "entrance", Map.of("preset", "fadeIn", "duration", 300)
                        )
                )
        );

        Map<String, Object> clean = validator.validateAndNormalizeElementMotion(raw, "hero.motion");
        assertEquals(1, clean.get("schemaVersion"));
        assertEquals("hero-fade-up", clean.get("presetRef"));
        assertNotNull(clean.get("entrance"));
        assertNotNull(clean.get("scroll"));
        assertNotNull(clean.get("hover"));
        assertNotNull(clean.get("interaction"));
        assertNotNull(clean.get("text"));
        assertNotNull(clean.get("stagger"));
        assertNotNull(clean.get("responsive"));
    }

    @Test
    void rejectsUnsafeOrOutOfRangeMotionPayloads() {
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeElementMotion(
                Map.of("entrance", Map.of("preset", "arbitraryJsHack")), "el.motion"
        ));
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeElementMotion(
                Map.of("entrance", Map.of("preset", "fadeIn", "duration", 99999)), "el.motion"
        ));
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeElementMotion(
                Map.of("hover", Map.of("preset", "shadow", "shadow", "expression(alert(1))")), "el.motion"
        ));
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeElementMotion(
                Map.of("entrance", Map.of("preset", "fadeIn", "easing", "cubic-bezier(2.5, 0, 1, 1)")), "el.motion"
        ));
    }

    @Test
    void blockSchemaValidatorPreservesValidatedNodeMotionAndThemeValidatorNormalizesGlobalMotion() {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", "hero-title");
        node.put("type", "heading");
        node.put("version", 2);
        node.put("label", "Hero Title");
        node.put("visible", true);
        node.put("locked", false);
        node.put("props", Map.of("text", "Hello", "tag", "h1"));
        node.put("styles", Map.of("base", Map.of("fontSize", "48px")));
        node.put("motion", Map.of(
                "enabled", true,
                "entrance", Map.of("enabled", true, "preset", "fadeInUp", "duration", 600, "easing", "easeOut")
        ));

        Map<String, Object> doc = Map.of("version", 2, "nodes", List.of(node));
        Map<String, Object> validatedDoc = blockValidator.validateAndNormalizeContent(doc);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) validatedDoc.get("nodes");
        assertNotNull(nodes.get(0).get("motion"));

        Map<String, Object> theme = new LinkedHashMap<>();
        theme.put("version", 1);
        theme.put("colors", Map.of("primary", "#5B46E8", "background", "#FFFFFF", "text", "#111318"));
        theme.put("motion", Map.of(
                "enabled", true,
                "mobileBehavior", "reduced",
                "defaultDuration", 420,
                "timingTokens", Map.of("fast", 120, "normal", 300, "slow", 700)
        ));
        Map<String, Object> validatedTheme = themeValidator.validateAndNormalize(theme);
        @SuppressWarnings("unchecked")
        Map<String, Object> motion = (Map<String, Object>) validatedTheme.get("motion");
        assertEquals(420, motion.get("defaultDuration"));
        assertEquals("reduced", motion.get("mobileBehavior"));
    }
}
