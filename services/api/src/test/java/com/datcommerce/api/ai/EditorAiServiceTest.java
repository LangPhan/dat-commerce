package com.datcommerce.api.ai;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class EditorAiServiceTest {

    private AiSettingsService settingsService;
    private EditorOperationValidator operationValidator;
    private MockAiModelGateway mockGateway;
    private NineRouterAiGateway nineRouterGateway;
    private AuditLogService auditLogService;
    private EditorAiService service;
    private AuthenticatedUser actor;
    private Map<String, Object> heroSubtree;
    private List<Map<String, Object>> pageOutline;

    @BeforeEach
    void setUp() {
        settingsService = Mockito.mock(AiSettingsService.class);
        operationValidator = new EditorOperationValidator();
        mockGateway = Mockito.mock(MockAiModelGateway.class);
        nineRouterGateway = Mockito.mock(NineRouterAiGateway.class);
        AppProperties appProperties = new AppProperties();
        appProperties.getAi().setGatewayMode("mock");
        auditLogService = Mockito.mock(AuditLogService.class);

        service = new EditorAiService(
                settingsService,
                operationValidator,
                mockGateway,
                nineRouterGateway,
                appProperties,
                auditLogService,
                new ObjectMapper()
        );

        UUID storeId = UUID.randomUUID();
        actor = new AuthenticatedUser(
                UUID.randomUUID(),
                storeId,
                "owner@terrain.test",
                "Terrain Owner",
                List.of("OWNER"),
                List.of("ai:use")
        );

        heroSubtree = Map.of(
                "id", "hero",
                "type", "section",
                "label", "Hero banner",
                "children", List.of(
                        Map.of(
                                "id", "hero-inner",
                                "type", "container",
                                "label", "Hero Content",
                                "children", List.of(
                                        Map.of("id", "hero-kicker", "type", "text_editor", "label", "Kicker", "props", Map.of("text", "AUTUMN / FIELD")),
                                        Map.of("id", "hero-title", "type", "heading", "label", "Headline", "props", Map.of("text", "Engineered for where the road ends.")),
                                        Map.of("id", "hero-copy", "type", "text_editor", "label", "Description", "props", Map.of("text", "Purpose-built footwear."))
                                )
                        )
                )
        );

        pageOutline = List.of(
                Map.of("id", "hero", "type", "section", "label", "Hero banner"),
                Map.of("id", "sec-featured", "type", "section", "label", "Featured Products")
        );
    }

    @Test
    void elementScopeAllowsEditingDescendantNodesAndPreservesSelectedTargetIds() {
        String gatewayJson = """
                {
                  "summary": "Update 3 hero text nodes",
                  "explanation": "Updated color and copy of child text nodes inside Hero banner.",
                  "operations": [
                    {"type":"update_styles","nodeId":"hero-kicker","breakpoint":"base","styles":{"color":"#FEF08A"}},
                    {"type":"update_styles","nodeId":"hero-title","breakpoint":"base","styles":{"color":"#FEF08A"}},
                    {"type":"update_props","nodeId":"hero-copy","props":{"text":"Updated hero description"}}
                  ]
                }
                """;
        when(mockGateway.generateTurn(any(AiModelGateway.GatewayRequest.class)))
                .thenReturn(new AiModelGateway.GatewayTurnResponse(gatewayJson, List.of(), 120, 60, "stop"));

        EditorAiService.EditorSuggestResponse response = service.suggest(
                actor,
                new EditorAiService.EditorSuggestRequest(
                        UUID.randomUUID(),
                        "home",
                        "desktop",
                        "element",
                        List.of("hero"),
                        "Update the 3 text nodes inside hero banner",
                        "gpt-6-luna",
                        heroSubtree,
                        pageOutline,
                        Map.of(),
                        List.of(),
                        null,
                        null
                )
        );

        assertEquals(3, response.operations().size());
        assertEquals("hero-kicker", response.operations().get(0).get("nodeId"));
        assertEquals("hero-title", response.operations().get(1).get("nodeId"));
        assertEquals("hero-copy", response.operations().get(2).get("nodeId"));
        assertEquals(List.of("hero"), response.targetNodeIds());

        ArgumentCaptor<AiModelGateway.GatewayRequest> reqCaptor = ArgumentCaptor.forClass(AiModelGateway.GatewayRequest.class);
        Mockito.verify(mockGateway).generateTurn(reqCaptor.capture());
        List<AiModelGateway.GatewayMessage> msgs = reqCaptor.getValue().messages();
        String userPayload = msgs.get(msgs.size() - 1).content();
        assertTrue(userPayload.contains("\"allowedNodeIds\""));
        assertTrue(userPayload.contains("hero-kicker"));
        assertTrue(userPayload.contains("hero-title"));
        assertTrue(userPayload.contains("hero-copy"));
    }

    @Test
    void elementScopeStillRejectsNodesOutsideSelectedSubtree() {
        String gatewayJson = """
                {
                  "summary": "Edit unrelated section",
                  "explanation": "Should be rejected by backend validator.",
                  "operations": [
                    {"type":"update_styles","nodeId":"sec-featured","breakpoint":"base","styles":{"backgroundColor":"#111111"}}
                  ]
                }
                """;
        when(mockGateway.generateTurn(any(AiModelGateway.GatewayRequest.class)))
                .thenReturn(new AiModelGateway.GatewayTurnResponse(gatewayJson, List.of(), 90, 30, "stop"));

        ApiException ex = assertThrows(
                ApiException.class,
                () -> service.suggest(
                        actor,
                        new EditorAiService.EditorSuggestRequest(
                                UUID.randomUUID(),
                                "home",
                                "desktop",
                                "element",
                                List.of("hero"),
                                "Make featured section dark",
                                "gpt-6-luna",
                                heroSubtree,
                                pageOutline,
                                Map.of(),
                                List.of(),
                                null,
                                null
                        )
                )
        );
        assertTrue(ex.getMessage().contains("outside selected element scope"));
    }

    @Test
    void elementScopeAllowsMultiSelectSubtrees() {
        List<Map<String, Object>> multiSubtree = List.of(
                Map.of(
                        "id", "card-1",
                        "type", "container",
                        "label", "Card 1",
                        "children", List.of(Map.of("id", "card-1-text", "type", "text_editor", "label", "Card 1 Copy"))
                ),
                Map.of(
                        "id", "card-2",
                        "type", "container",
                        "label", "Card 2",
                        "children", List.of(Map.of("id", "card-2-text", "type", "text_editor", "label", "Card 2 Copy"))
                )
        );
        String gatewayJson = """
                {
                  "summary": "Color both card copies",
                  "explanation": "Updated text color inside both selected cards.",
                  "operations": [
                    {"type":"update_styles","nodeId":"card-1-text","breakpoint":"base","styles":{"color":"#FEF08A"}},
                    {"type":"update_styles","nodeId":"card-2-text","breakpoint":"base","styles":{"color":"#FEF08A"}}
                  ]
                }
                """;
        when(mockGateway.generateTurn(any(AiModelGateway.GatewayRequest.class)))
                .thenReturn(new AiModelGateway.GatewayTurnResponse(gatewayJson, List.of(), 100, 50, "stop"));

        EditorAiService.EditorSuggestResponse response = service.suggest(
                actor,
                new EditorAiService.EditorSuggestRequest(
                        UUID.randomUUID(),
                        "home",
                        "desktop",
                        "element",
                        List.of("card-1", "card-2"),
                        "Highlight text in both cards",
                        "gpt-6-luna",
                        multiSubtree,
                        pageOutline,
                        Map.of(),
                        List.of(),
                        null,
                        null
                )
        );

        assertEquals(2, response.operations().size());
        assertEquals(List.of("card-1", "card-2"), response.targetNodeIds());
    }

    @Test
    void elementScopeForwardsEditablePartsAndAllowsPartStyleOps() {
        Map<String, Object> bestSection = Map.of(
                "id", "best",
                "type", "section",
                "label", "Best Sellers",
                "children", List.of(
                        Map.of(
                                "id", "best-grid",
                                "type", "product_grid",
                                "label", "Best Sellers Grid"
                        )
                )
        );
        String gatewayJson = """
                {
                  "summary": "Round product cards and green prices",
                  "explanation": "Styled all repeating product cards and prices via partStyles.",
                  "operations": [
                    {"type":"update_part_styles","nodeId":"best-grid","part":"card","breakpoint":"base","styles":{"borderRadius":"16px","backgroundColor":"#F8FAFC"}},
                    {"type":"update_part_styles","nodeId":"best-grid","part":"price","breakpoint":"base","styles":{"color":"#18794E"}}
                  ]
                }
                """;
        when(mockGateway.generateTurn(any(AiModelGateway.GatewayRequest.class)))
                .thenReturn(new AiModelGateway.GatewayTurnResponse(gatewayJson, List.of(), 130, 70, "stop"));

        EditorAiService.EditorSuggestResponse response = service.suggest(
                actor,
                new EditorAiService.EditorSuggestRequest(
                        UUID.randomUUID(),
                        "home",
                        "desktop",
                        "element",
                        List.of("best-grid"),
                        "Đổi màu giá sang xanh lá và bo tròn card sản phẩm 16px",
                        "gpt-6-luna",
                        bestSection,
                        pageOutline,
                        Map.of(),
                        List.of(),
                        "price",
                        Map.of("best-grid", List.of("card", "image", "title", "price", "subtitle", "rating"))
                )
        );

        assertEquals(2, response.operations().size());
        assertEquals("update_part_styles", response.operations().get(0).get("type"));
        assertEquals("card", response.operations().get(0).get("part"));

        ArgumentCaptor<AiModelGateway.GatewayRequest> reqCaptor = ArgumentCaptor.forClass(AiModelGateway.GatewayRequest.class);
        Mockito.verify(mockGateway).generateTurn(reqCaptor.capture());
        List<AiModelGateway.GatewayMessage> msgs = reqCaptor.getValue().messages();
        String userPayload = msgs.get(msgs.size() - 1).content();
        assertTrue(userPayload.contains("\"selectedPart\":\"price\""));
        assertTrue(userPayload.contains("\"editableParts\""));
        assertTrue(userPayload.contains("best-grid"));
    }

    @Test
    void supportsMotionScopeAndValidatedAnimationOperations() {
        String gatewayJson = """
                {
                  "summary": "Fade in heading & reduce mobile motion",
                  "explanation": "Added fadeInUp entrance and mobile reduced motion policy.",
                  "operations": [
                    {
                      "type": "set_element_animation",
                      "nodeId": "hero-heading",
                      "motion": {
                        "enabled": true,
                        "entrance": { "enabled": true, "preset": "fadeInUp", "duration": 600, "easing": "easeOut" }
                      }
                    },
                    {
                      "type": "update_global_motion",
                      "motion": { "enabled": true, "mobileBehavior": "reduced" }
                    }
                  ]
                }
                """;
        when(mockGateway.generateTurn(any(AiModelGateway.GatewayRequest.class)))
                .thenReturn(new AiModelGateway.GatewayTurnResponse(gatewayJson, List.of(), 120, 80, "stop"));

        EditorAiService.EditorSuggestResponse response = service.suggest(
                actor,
                new EditorAiService.EditorSuggestRequest(
                        UUID.randomUUID(),
                        "home",
                        "desktop",
                        "motion",
                        List.of("hero-heading"),
                        "Make heading fade in up over 600ms and reduce motion on mobile",
                        "gpt-6-luna",
                        Map.of("id", "hero-heading", "type", "heading"),
                        List.of(Map.of("id", "hero-heading", "type", "heading")),
                        Map.of(),
                        List.of(),
                        null,
                        Map.of()
                )
        );

        assertEquals(2, response.operations().size());
        assertEquals("set_element_animation", response.operations().get(0).get("type"));
        assertEquals("update_global_motion", response.operations().get(1).get("type"));
    }

    @Test
    void executesReadOnlyDesignToolLoopAndReportsUsedStoreDataSources() {
        EditorDesignDataService designData = Mockito.mock(EditorDesignDataService.class);
        when(designData.buildCompactStoreManifest(actor.storeId())).thenReturn(Map.of(
                "collections", List.of(Map.of("name", "Summer Trail", "slug", "summer-trail", "productCount", 4))
        ));
        when(designData.designToolDefinitions()).thenReturn(List.of(
                new AiModelGateway.ToolDefinition("design.list_collections", "List collections", Map.of("type", "object", "properties", Map.of()))
        ));
        when(designData.executeDesignTool(actor.storeId(), "design.list_collections", Map.of("includeProducts", true)))
                .thenReturn(new EditorDesignDataService.DesignToolExecutionResult(
                        "collections",
                        Map.of("count", 1, "collections", List.of(Map.of("name", "Summer Trail", "slug", "summer-trail")))
                ));

        AppProperties props = new AppProperties();
        props.getAi().setGatewayMode("mock");
        EditorAiService dataAwareService = new EditorAiService(
                settingsService,
                operationValidator,
                mockGateway,
                nineRouterGateway,
                props,
                auditLogService,
                new ObjectMapper(),
                designData
        );

        AiModelGateway.GatewayToolCall call = new AiModelGateway.GatewayToolCall(
                "call_1", "design.list_collections", Map.of("includeProducts", true)
        );
        String finalJson = """
                {
                  "summary": "Build Summer Trail collection section",
                  "explanation": "Created a showcase for the Summer Trail collection using live store data.",
                  "operations": [
                    {
                      "type": "insert_node",
                      "parentId": null,
                      "index": 1,
                      "node": {
                        "id": "sec-col-1",
                        "type": "section",
                        "label": "Summer Trail Showcase",
                        "visible": true,
                        "locked": false,
                        "props": {},
                        "styles": { "base": { "paddingTop": "48px", "paddingBottom": "48px" } },
                        "children": [
                          {
                            "id": "col-h-1",
                            "type": "heading",
                            "label": "Heading",
                            "visible": true,
                            "locked": false,
                            "props": { "text": "Summer Trail", "tag": "h2", "href": "/store/shop?collection=summer-trail" },
                            "styles": { "base": {} }
                          }
                        ]
                      }
                    }
                  ]
                }
                """;
        when(mockGateway.generateTurn(any(AiModelGateway.GatewayRequest.class)))
                .thenReturn(new AiModelGateway.GatewayTurnResponse("", List.of(call), 100, 30, "tool_calls"))
                .thenReturn(new AiModelGateway.GatewayTurnResponse(finalJson, List.of(), 180, 95, "stop"));

        EditorAiService.EditorSuggestResponse response = dataAwareService.suggest(
                actor,
                new EditorAiService.EditorSuggestRequest(
                        UUID.randomUUID(),
                        "home",
                        "desktop",
                        "page",
                        List.of(),
                        "Create a design for our Collections",
                        "gpt-6-luna",
                        List.of(),
                        List.of(),
                        Map.of(),
                        List.of(),
                        null,
                        Map.of()
                )
        );

        assertEquals(1, response.operations().size());
        assertTrue(response.usedDataSources().contains("collections"));
    }
}
