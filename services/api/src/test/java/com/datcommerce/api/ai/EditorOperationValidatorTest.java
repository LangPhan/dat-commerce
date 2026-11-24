package com.datcommerce.api.ai;

import com.datcommerce.api.common.exception.ApiException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    @Test
    void rejectsNullParentInsertButAllowsDescendantContainerInsertInElementScope() {
        Map<String, Object> childNode = Map.of(
                "id", "ai-copy-1",
                "type", "text_editor",
                "version", 2,
                "label", "Inserted Copy",
                "visible", true,
                "locked", false,
                "props", Map.of("text", "Added text"),
                "styles", Map.of("base", Map.of())
        );

        Map<String, Object> nullParentOp = new HashMap<>();
        nullParentOp.put("type", "insert_node");
        nullParentOp.put("parentId", null);
        nullParentOp.put("index", 0);
        nullParentOp.put("node", childNode);

        ApiException rejected = assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalize(
                        List.of(nullParentOp),
                        "element",
                        Set.of("hero", "hero-inner"),
                        Set.of("hero", "hero-inner", "sec-featured")
                )
        );
        assertTrue(rejected.getMessage().contains("outside element scope"));

        List<Map<String, Object>> ok = validator.validateAndNormalize(
                List.of(Map.of(
                        "type", "insert_node",
                        "parentId", "hero-inner",
                        "index", 0,
                        "node", childNode
                )),
                "element",
                Set.of("hero", "hero-inner"),
                Set.of("hero", "hero-inner", "sec-featured")
        );
        assertEquals(1, ok.size());
        assertEquals("hero-inner", ok.get(0).get("parentId"));
    }

    @Test
    void normalizesPartStyleOperationsAndRejectsInvalidPartOrScope() {
        List<Map<String, Object>> ops = validator.validateAndNormalize(
                List.of(
                        Map.of(
                                "type", "update_part_styles",
                                "nodeId", "best-grid",
                                "part", "card",
                                "breakpoint", "base",
                                "styles", Map.of("borderRadius", "16px", "backgroundColor", "#F8FAFC")
                        ),
                        Map.of(
                                "type", "reset_part_style_keys",
                                "nodeId", "best-grid",
                                "part", "price",
                                "breakpoint", "mobile",
                                "keys", List.of("color")
                        )
                ),
                "element",
                Set.of("best-sec", "best-grid"),
                Set.of("best-sec", "best-grid", "other-sec")
        );
        assertEquals(2, ops.size());
        assertEquals("card", ops.get(0).get("part"));
        assertEquals("price", ops.get(1).get("part"));

        assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalize(
                        List.of(Map.of(
                                "type", "update_part_styles",
                                "nodeId", "best-grid",
                                "part", "invalid part!",
                                "styles", Map.of("color", "#000000")
                        )),
                        "element",
                        Set.of("best-grid"),
                        Set.of("best-grid")
                )
        );

        assertThrows(
                ApiException.class,
                () -> validator.validateAndNormalize(
                        List.of(Map.of(
                                "type", "update_part_styles",
                                "nodeId", "other-sec",
                                "part", "card",
                                "styles", Map.of("color", "#000000")
                        )),
                        "element",
                        Set.of("best-grid"),
                        Set.of("best-grid", "other-sec")
                )
        );
    }
}
