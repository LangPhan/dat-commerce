package com.datcommerce.api.cms;

import com.datcommerce.api.common.exception.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ThemeTokenValidatorTest {

    private final ThemeTokenValidator validator = new ThemeTokenValidator();

    private Map<String, Object> basePayload() {
        Map<String, Object> tokens = new LinkedHashMap<>(ThemeTokenValidator.defaultTokens());
        tokens.remove("header");
        tokens.remove("footer");
        return tokens;
    }

    @Test
    void populatesDefaultHeaderAndFooterWhenOmittedForLegacyCompatibility() {
        Map<String, Object> normalized = validator.validateAndNormalize(basePayload());
        assertInstanceOf(Map.class, normalized.get("header"));
        assertInstanceOf(Map.class, normalized.get("footer"));

        @SuppressWarnings("unchecked")
        Map<String, Object> header = (Map<String, Object>) normalized.get("header");
        @SuppressWarnings("unchecked")
        Map<String, Object> logo = (Map<String, Object>) header.get("logo");
        assertEquals("TERRAIN", logo.get("text"));

        @SuppressWarnings("unchecked")
        Map<String, Object> footer = (Map<String, Object>) normalized.get("footer");
        @SuppressWarnings("unchecked")
        List<?> columns = (List<?>) footer.get("columns");
        assertEquals(3, columns.size());
    }

    @Test
    void validatesAndNormalizesCustomHeaderAndFooter() {
        Map<String, Object> payload = basePayload();
        payload.put("header", Map.of(
                "announcement", Map.of(
                        "enabled", true,
                        "text", "Winter Sale — 20% off",
                        "linkUrl", "/store/collections",
                        "bgColor", "#112233",
                        "textColor", "#ffffff"
                ),
                "logo", Map.of(
                        "text", "Alpine Studio",
                        "imageUrl", "/media/logo.png",
                        "showIcon", false,
                        "heightPx", 36
                ),
                "layout", Map.of(
                        "sticky", false,
                        "heightPx", 72,
                        "bgColor", "#fafafa",
                        "textColor", "#111111",
                        "borderColor", "#e5e7eb"
                ),
                "actions", Map.of(
                        "showSearch", true,
                        "showWishlist", false,
                        "showAccount", true,
                        "showCart", true
                )
        ));
        payload.put("footer", Map.of(
                "brand", Map.of(
                        "name", "Alpine Studio",
                        "logoImageUrl", "https://cdn.example.com/logo.svg",
                        "showIcon", false,
                        "description", "Precision alpine gear."
                ),
                "columns", List.of(
                        Map.of(
                                "id", "col-1",
                                "title", "Explore",
                                "links", List.of(Map.of("id", "shop", "label", "Shop", "url", "/store/shop"))
                        )
                ),
                "socialLinks", List.of(
                        Map.of("id", "ig", "platform", "instagram", "url", "https://instagram.com/alpinestudio")
                ),
                "bottomBar", Map.of(
                        "copyrightText", "© {year} Alpine Studio",
                        "contactEmail", "hello@alpinestudio.example"
                ),
                "style", Map.of(
                        "bgColor", "#0f172a",
                        "textColor", "#f8fafc",
                        "mutedColor", "#94a3b8",
                        "borderColor", "#1e293b"
                )
        ));

        Map<String, Object> normalized = validator.validateAndNormalize(payload);
        @SuppressWarnings("unchecked")
        Map<String, Object> header = (Map<String, Object>) normalized.get("header");
        @SuppressWarnings("unchecked")
        Map<String, Object> ann = (Map<String, Object>) header.get("announcement");
        assertEquals("#112233", ann.get("bgColor"));
        assertEquals("#FFFFFF", ann.get("textColor"));
        assertEquals("/store/collections", ann.get("linkUrl"));
    }

    @Test
    void rejectsUnsafeUrlsAndOutOfRangeHeaderFooterValues() {
        Map<String, Object> badUrl = basePayload();
        badUrl.put("header", Map.of("announcement", Map.of("linkUrl", "javascript:alert(1)")));
        assertThrows(ApiException.class, () -> validator.validateAndNormalize(badUrl));

        Map<String, Object> badHeight = basePayload();
        badHeight.put("header", Map.of("layout", Map.of("heightPx", 200)));
        assertThrows(ApiException.class, () -> validator.validateAndNormalize(badHeight));

        Map<String, Object> tooManyCols = basePayload();
        tooManyCols.put("footer", Map.of("columns", List.of(
                Map.of("title", "1"), Map.of("title", "2"), Map.of("title", "3"),
                Map.of("title", "4"), Map.of("title", "5")
        )));
        assertThrows(ApiException.class, () -> validator.validateAndNormalize(tooManyCols));
    }
}
