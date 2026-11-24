package com.datcommerce.api.cms;

import com.datcommerce.api.common.exception.ApiException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BlockSchemaValidatorV2Test {

    private final BlockSchemaValidator validator = new BlockSchemaValidator();
    private final ThemeTokenValidator themeValidator = new ThemeTokenValidator();

    @Test
    void acceptsValidNestedV2DocumentAndCountsNodes() {
        Map<String, Object> heading = Map.of(
                "id", "h1",
                "type", "heading",
                "label", "Hero Title",
                "props", Map.of("text", "Alpine Field Pack", "tag", "h1"),
                "styles", Map.of(
                        "base", Map.of("fontSize", "48px", "color", "#111318"),
                        "mobile", Map.of("fontSize", "32px")
                )
        );
        Map<String, Object> container = Map.of(
                "id", "c1",
                "type", "container",
                "label", "Hero Inner",
                "props", Map.of("maxWidth", "1200px"),
                "styles", Map.of("base", Map.of("display", "flex", "flexDirection", "column")),
                "children", List.of(heading)
        );
        Map<String, Object> section = Map.of(
                "id", "sec-1",
                "type", "section",
                "label", "Hero Section",
                "props", Map.of(),
                "styles", Map.of("base", Map.of("paddingTop", "64px")),
                "children", List.of(container)
        );

        Map<String, Object> out = validator.validateAndNormalizeContent(Map.of(
                "version", 2,
                "nodes", List.of(section)
        ));

        assertEquals(2, out.get("version"));
        assertEquals(3, BlockSchemaValidator.countNodes(out));
    }

    @Test
    void rejectsLeafElementWithChildren() {
        Map<String, Object> invalid = Map.of(
                "id", "btn-1",
                "type", "button",
                "label", "CTA",
                "props", Map.of("label", "Shop", "href", "/store/shop"),
                "children", List.of(Map.of("id", "nested", "type", "heading", "label", "Inner", "props", Map.of("text", "Bad")))
        );

        assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalizeContent(Map.of("version", 2, "nodes", List.of(invalid)))
        );
    }

    @Test
    void rejectsOverDepth12Hierarchy() {
        Map<String, Object> current = Map.of(
                "id", "leaf-node",
                "type", "heading",
                "label", "Deep Leaf",
                "props", Map.of("text", "Too deep")
        );
        for (int d = 12; d >= 1; d--) {
            current = Map.of(
                    "id", "box-" + d,
                    "type", "container",
                    "label", "Box " + d,
                    "props", Map.of(),
                    "children", List.of(current)
            );
        }

        Map<String, Object> payload = Map.of("version", 2, "nodes", List.of(current));
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeContent(payload));
    }

    @Test
    void rejectsOver250Nodes() {
        List<Map<String, Object>> children = new ArrayList<>();
        for (int i = 0; i < 252; i++) {
            children.add(Map.of(
                    "id", "item-" + i,
                    "type", "divider",
                    "label", "Divider " + i,
                    "props", Map.of()
            ));
        }
        Map<String, Object> root = Map.of(
                "id", "sec-many",
                "type", "section",
                "label", "Many",
                "props", Map.of(),
                "children", children
        );
        assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalizeContent(Map.of("version", 2, "nodes", List.of(root)))
        );
    }

    @Test
    void rejectsUnsafeCustomHtmlCssAndUrls() {
        Map<String, Object> xssHtml = Map.of(
                "id", "html-1",
                "type", "custom_html",
                "label", "Embed",
                "props", Map.of("html", "<div onclick=\"alert(1)\">Hi</div>")
        );
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeContent(Map.of("version", 2, "nodes", List.of(xssHtml))));

        Map<String, Object> badCss = Map.of(
                "id", "h-bad-css",
                "type", "heading",
                "label", "Heading",
                "props", Map.of("text", "Safe"),
                "styles", Map.of("base", Map.of("backgroundImage", "url(javascript:alert(1))"))
        );
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeContent(Map.of("version", 2, "nodes", List.of(badCss))));

        Map<String, Object> unknownStyleProp = Map.of(
                "id", "h-bad-prop",
                "type", "heading",
                "label", "Heading",
                "props", Map.of("text", "Safe"),
                "styles", Map.of("base", Map.of("behavior", "url(evil.htc)"))
        );
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeContent(Map.of("version", 2, "nodes", List.of(unknownStyleProp))));
    }

    @Test
    void keepsV1BackwardCompatibilityAndExtendsThemeTokens() {
        Map<String, Object> v1 = validator.validateAndNormalizeContent(Map.of(
                "blocks", List.of(Map.of(
                        "id", "b1",
                        "type", "hero",
                        "label", "Hero",
                        "visible", true,
                        "props", Map.of("heading", "Hello", "tone", "forest")
                ))
        ));
        assertEquals(1, v1.get("version"));
        assertEquals(1, BlockSchemaValidator.countNodes(v1));

        Map<String, Object> rawTokens = new LinkedHashMap<>();
        rawTokens.put("colors", Map.of("primary", "#2563eb", "secondary", "#0f172a", "background", "#ffffff", "text", "#111318", "border", "#e2e8f0"));
        rawTokens.put("spacing", Map.of("sectionY", "80px", "blockGap", "32px"));
        Map<String, Object> cleanTokens = themeValidator.validateAndNormalize(rawTokens);
        assertTrue(cleanTokens.containsKey("spacing"));
    }
}
