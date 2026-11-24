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

    @Test
    void normalizesAndRejectsUnsafePartStyles() {
        Map<String, Object> grid = Map.of(
                "id", "best-grid",
                "type", "product_grid",
                "label", "Best Sellers",
                "props", Map.of("columns", 4, "limit", 8),
                "styles", Map.of("base", Map.of()),
                "partStyles", Map.of(
                        "card", Map.of("base", Map.of("borderRadius", "16px", "backgroundColor", "#F8FAFC")),
                        "price", Map.of("base", Map.of("color", "#18794E")),
                        "empty_part", Map.of("base", Map.of())
                )
        );
        Map<String, Object> clean = validator.validateAndNormalizeContent(Map.of(
                "version", 2,
                "nodes", List.of(grid)
        ));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) clean.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> partStyles = (Map<String, Object>) nodes.get(0).get("partStyles");
        assertTrue(partStyles.containsKey("card"));
        assertTrue(partStyles.containsKey("price"));
        assertTrue(!partStyles.containsKey("empty_part"));

        Map<String, Object> badKey = Map.of(
                "id", "grid-bad-key",
                "type", "product_grid",
                "label", "Grid",
                "props", Map.of(),
                "partStyles", Map.of("bad key!", Map.of("base", Map.of("color", "#000000")))
        );
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeContent(Map.of("version", 2, "nodes", List.of(badKey))));

        Map<String, Object> unsafeCss = Map.of(
                "id", "grid-bad-css",
                "type", "product_grid",
                "label", "Grid",
                "props", Map.of(),
                "partStyles", Map.of("card", Map.of("base", Map.of("backgroundImage", "url(javascript:alert(1))")))
        );
        assertThrows(ApiException.class, () -> validator.validateAndNormalizeContent(Map.of("version", 2, "nodes", List.of(unsafeCss))));
    }

    @Test
    void validatesExtendedBackgroundPropertiesAndCustomThemePalette() {
        Map<String, Object> section = Map.of(
                "id", "bg-hero",
                "type", "section",
                "label", "Hero",
                "props", Map.of(),
                "styles", Map.of(
                        "base", Map.of(
                                "backgroundImage", "linear-gradient(rgba(17,19,24,0.35), rgba(17,19,24,0.35)), url(/storage/media/terrain-hero-banner-asset.jpg)",
                                "backgroundPosition", "center top",
                                "backgroundSize", "cover",
                                "backgroundRepeat", "no-repeat",
                                "backgroundAttachment", "fixed"
                        )
                )
        );
        Map<String, Object> cleanPage = validator.validateAndNormalizeContent(Map.of(
                "version", 2,
                "nodes", List.of(section)
        ));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) cleanPage.get("nodes");
        @SuppressWarnings("unchecked")
        Map<String, Object> baseStyles = (Map<String, Object>) ((Map<String, Object>) nodes.get(0).get("styles")).get("base");
        assertEquals("no-repeat", baseStyles.get("backgroundRepeat"));
        assertEquals("fixed", baseStyles.get("backgroundAttachment"));

        Map<String, Object> tokensWithPalette = new LinkedHashMap<>();
        tokensWithPalette.put("colors", Map.of("primary", "#274e36", "background", "#ffffff", "text", "#111318"));
        tokensWithPalette.put("customPalette", List.of(
                Map.of("id", "terracotta", "name", "Terracotta", "hex", "#c85a32"),
                Map.of("name", "Sage Mist", "hex", "#8fa89b")
        ));
        Map<String, Object> cleanTheme = themeValidator.validateAndNormalize(tokensWithPalette);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> palette = (List<Map<String, Object>>) cleanTheme.get("customPalette");
        assertEquals(2, palette.size());
        assertEquals("#C85A32", palette.get(0).get("hex"));
        assertEquals("sage-mist", palette.get(1).get("id"));

        Map<String, Object> badHexTokens = new LinkedHashMap<>();
        badHexTokens.put("colors", Map.of("primary", "#274e36", "background", "#ffffff", "text", "#111318"));
        badHexTokens.put("customPalette", List.of(Map.of("name", "Bad", "hex", "red")));
        assertThrows(ApiException.class, () -> themeValidator.validateAndNormalize(badHexTokens));

        List<Map<String, Object>> oversized = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            oversized.add(Map.of("id", "c-" + i, "name", "Color " + i, "hex", "#112233"));
        }
        Map<String, Object> tooManyTokens = new LinkedHashMap<>();
        tooManyTokens.put("colors", Map.of("primary", "#274e36", "background", "#ffffff", "text", "#111318"));
        tooManyTokens.put("customPalette", oversized);
        assertThrows(ApiException.class, () -> themeValidator.validateAndNormalize(tooManyTokens));
    }
}
