package com.datcommerce.api.ai;

import com.datcommerce.api.common.exception.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EditorOperationValidatorTest {

    private final EditorOperationValidator validator = new EditorOperationValidator();

    @Test
    void normalizesValidStyleAndPropOperationsInsideScope() {
        List<Map<String, Object>> out = validator.validateAndNormalize(
                List.of(
                        Map.of(
                                "type", "update_styles",
                                "nodeId", "h1",
                                "breakpoint", "mobile",
                                "styles", Map.of("fontSize", "28px", "color", "#2563EB")
                        ),
                        Map.of(
                                "type", "update_props",
                                "nodeId", "h1",
                                "props", Map.of("text", "Updated Headline")
                        )
                ),
                "element",
                Set.of("h1"),
                Set.of("sec-1", "h1")
        );

        assertEquals(2, out.size());
        assertEquals("mobile", out.get(0).get("breakpoint"));
    }

    @Test
    void rejectsOutOfScopeNodeModificationInElementMode() {
        assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalize(
                        List.of(Map.of(
                                "type", "update_styles",
                                "nodeId", "sec-1",
                                "breakpoint", "base",
                                "styles", Map.of("backgroundColor", "#000000")
                        )),
                        "element",
                        Set.of("h1"),
                        Set.of("sec-1", "h1")
                )
        );
    }

    @Test
    void rejectsUnsafeCssAndUrls() {
        assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalize(
                        List.of(Map.of(
                                "type", "update_styles",
                                "nodeId", "h1",
                                "styles", Map.of("backgroundImage", "url(javascript:alert(1))")
                        )),
                        "element",
                        Set.of("h1"),
                        Set.of("h1")
                )
        );

        assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalize(
                        List.of(Map.of(
                                "type", "update_props",
                                "nodeId", "btn-1",
                                "props", Map.of("href", "javascript:alert(1)")
                        )),
                        "element",
                        Set.of("btn-1"),
                        Set.of("btn-1")
                )
        );
    }
}
