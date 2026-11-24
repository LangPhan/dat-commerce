package com.datcommerce.api.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class MockAiModelGateway implements AiModelGateway {

    private static final Pattern PCT_PATTERN = Pattern.compile("(-?\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern UUID_PATTERN = Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private final ObjectMapper objectMapper;

    public MockAiModelGateway(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public List<AvailableModelInfo> listAvailableModels() {
        return List.of(
                new AvailableModelInfo("gpt-6-luna", "9router", 128000, 16384, true, true, true),
                new AvailableModelInfo("cx/gpt-6-luna", "cx", 128000, 16384, true, true, true),
                new AvailableModelInfo("claude-code", "combo", 128000, 64000, true, true, true),
                new AvailableModelInfo("claude-sonnet-4", "combo", 200000, 16384, true, true, true),
                new AvailableModelInfo("forma-fast", "9router", 64000, 8192, false, true, false)
        );
    }

    @Override
    public GatewayTurnResponse generateTurn(GatewayRequest request) {
        String prompt = extractLatestUserPrompt(request.messages());
        String lower = prompt.toLowerCase(Locale.ROOT);
        List<GatewayMessage> toolMsgs = extractCurrentTurnToolResults(request.messages());
        Map<String, Object> ctx = request.context() != null ? request.context() : Map.of();
        if ("editor_suggest".equals(String.valueOf(ctx.get("mode")))) {
            return generateEditorSuggestTurn(prompt, lower, ctx);
        }

        // Round 0: emit initial read or propose tool calls, or ask clarification if ambiguous
        if (toolMsgs.isEmpty()) {
            // Case: Prompt ambiguity check ("Tăng giá Nike" / "Increase Nike prices" without percentage or scope)
            if ((lower.contains("tăng giá") || lower.contains("increase price") || lower.contains("change price"))
                    && !PCT_PATTERN.matcher(lower).find()) {
                return textResponse(
                        "Please clarify the price change scope and exact percentage: do you want to adjust a specific product SKU or a category (for example, +5% across Nike in Running Shoes)?",
                        120, 42
                );
            }

            // Case: Explicit nonexistent ID or lookup by ID/slug
            Matcher uuidMatcher = UUID_PATTERN.matcher(prompt);
            if (uuidMatcher.find() && (lower.contains("product") || lower.contains("sản phẩm") || lower.contains("tìm") || lower.contains("find"))) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "catalog.get_product", Map.of("productIdOrSlug", uuidMatcher.group())
                )), 110, 24);
            }

            // Case: Bulk price update
            if (PCT_PATTERN.matcher(lower).find()
                    && (lower.contains("price") || lower.contains("giá") || lower.contains("nike"))) {
                String brand = lower.contains("nike") ? "Nike" : "";
                String q = brand.isEmpty() ? "" : brand;
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "catalog.search_products",
                        Map.of("q", q, "brand", brand)
                )), 140, 28);
            }

            // Case: CMS Page change (Add best sellers or edit hero / selected block)
            if (lower.contains("best sellers") || lower.contains("hero") || lower.contains("split")
                    || lower.contains("homepage") || lower.contains("page") || lower.contains("section")
                    || lower.contains("cta") || lower.contains("trang chủ")) {
                String slug = ctx.get("pageSlug") != null ? String.valueOf(ctx.get("pageSlug")) : "home";
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "content.get_page", Map.of("slug", slug)
                )), 130, 22);
            }

            // Case: Theme token change
            if (lower.contains("theme") || lower.contains("primary color") || lower.contains("font")
                    || lower.contains("radius")) {
                Map<String, Object> colors = new LinkedHashMap<>();
                colors.put("primary", lower.contains("#0") || lower.contains("#") ? extractHex(prompt, "#1E40AF") : "#1E40AF");
                colors.put("background", "#FFFFFF");
                colors.put("text", "#111318");
                Map<String, Object> tokens = Map.of("colors", colors);
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "content.propose_theme_change",
                        Map.of("tokens", tokens, "note", "AI proposed theme palette update")
                )), 140, 35);
            }

            // Case: Create promotion / discount
            if (lower.contains("discount") || lower.contains("promo") || lower.contains("coupon") || lower.contains("giảm giá")) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "catalog.list_categories", Map.of()
                )), 110, 20);
            }

            // Case: Stock / inventory adjustment
            if (lower.contains("stock") || lower.contains("inventory") || lower.contains("tồn kho")) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "inventory.get_stock", Map.of("q", extractSearchTerm(prompt))
                )), 115, 22);
            }

            // Case: Create Product Type / Monitor
            if (lower.contains("product type") || lower.contains("loại sản phẩm") || lower.contains("monitor")) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "catalog.propose_create_product_type",
                        Map.of(
                                "code", "monitor",
                                "name", "Monitor",
                                "description", "Calibrated studio displays and OLED monitors",
                                "variantOptions", List.of(Map.of("code", "size", "name", "Size")),
                                "newAttributes", List.of(
                                        Map.of("code", "panel_type", "name", "Panel Type", "dataType", "TEXT", "required", true, "filterable", true),
                                        Map.of("code", "refresh_rate_hz", "name", "Refresh Rate", "dataType", "NUMBER", "unit", "Hz", "required", true, "filterable", true)
                                )
                        )
                )), 150, 48);
            }

            // Case: Create product
            if (lower.contains("tạo laptop") || lower.contains("create product") || lower.contains("dell inspiron")) {
                return toolResponse(List.of(
                        new GatewayToolCall(callId(), "catalog.get_product_type", Map.of("code", "laptop")),
                        new GatewayToolCall(callId(), "catalog.list_categories", Map.of())
                ), 145, 36);
            }

            // Case: Create category
            if (lower.contains("create category") || lower.contains("new category") || lower.contains("tạo category")
                    || (lower.contains("running shoes") && lower.contains("category"))) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "catalog.propose_create_category",
                        Map.of(
                                "name", "Alpine Gear",
                                "slug", "alpine-gear",
                                "description", "High-altitude technical mountaineering essentials"
                        )
                )), 125, 26);
            }

            // Case: Analytics / revenue
            if (lower.contains("revenue") || lower.contains("analytics") || lower.contains("sales")
                    || lower.contains("doanh thu") || lower.contains("báo cáo")) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "analytics.get_summary", Map.of()
                )), 120, 20);
            }

            // Case: Orders search
            if (lower.contains("order") || lower.contains("đơn hàng")) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "orders.search", Map.of("q", "")
                )), 120, 20);
            }

            // Default Read Search (also handles "Tìm Nike Pegasus", prompt injection search, etc.)
            String searchQ = extractSearchTerm(prompt);
            return toolResponse(List.of(new GatewayToolCall(
                    callId(), "catalog.search_products", Map.of("q", searchQ)
            )), 110, 22);
        }

        // Round >= 1: examine tool results and either chain propose tool or produce grounded summary
        GatewayMessage lastTool = toolMsgs.getLast();
        JsonNode resultJson = parseNode(lastTool.content());

        if (request.round() == 1 && "catalog.search_products".equals(lastTool.toolName())
                && PCT_PATTERN.matcher(lower).find()) {
            Matcher m = PCT_PATTERN.matcher(lower);
            double pct = m.find() ? Double.parseDouble(m.group(1)) : 5.0;
            String brand = lower.contains("nike") ? "Nike" : "";
            String category = lower.contains("running") ? "running-shoes" : "";
            return toolResponse(List.of(new GatewayToolCall(
                    callId(), "catalog.propose_bulk_price_update",
                    Map.of(
                            "brand", brand,
                            "categorySlug", category,
                            "percentDelta", pct,
                            "reason", "AI price update: " + prompt
                    )
            )), 190, 44);
        }

        if (request.round() == 1 && "content.get_page".equals(lastTool.toolName())) {
            JsonNode pageObj = resultJson.path("latestVersion").path("content");
            List<Map<String, Object>> blocks = toMapList(pageObj.path("blocks"));
            String summary;
            if (lower.contains("split") || lower.contains("cta") || lower.contains("selected") || ctx.get("selectedBlockId") != null) {
                String targetId = ctx.get("selectedBlockId") != null ? String.valueOf(ctx.get("selectedBlockId")) : "hero";
                blocks = updateHeroOrSelected(blocks, targetId, lower);
                summary = "Update selected section (" + targetId + ") in draft";
            } else {
                blocks = insertBestSellersAfterHero(blocks);
                summary = "Insert Best Sellers section below Hero in draft";
            }
            String slug = resultJson.path("slug").asText("home");
            long version = resultJson.path("version").asLong(0);
            return toolResponse(List.of(new GatewayToolCall(
                    callId(), "content.propose_page_change",
                    Map.of(
                            "pageSlug", slug,
                            "expectedVersion", version,
                            "changeSummary", summary,
                            "blocks", blocks
                    )
            )), 210, 64);
        }

        if (request.round() == 1 && "catalog.list_categories".equals(lastTool.toolName())
                && (lower.contains("discount") || lower.contains("promo") || lower.contains("coupon"))) {
            Matcher m = PCT_PATTERN.matcher(lower);
            double pct = m.find() ? Double.parseDouble(m.group(1)) : 15.0;
            String footwearId = findCategoryIdBySlug(resultJson, "footwear");
            Map<String, Object> args = new LinkedHashMap<>();
            args.put("code", "FOOTWEAR" + Math.round(pct));
            args.put("name", "Footwear " + Math.round(pct) + "% Seasonal Promotion");
            args.put("type", "PERCENTAGE");
            args.put("value", pct);
            if (footwearId != null) {
                args.put("scopeType", "CATEGORY");
                args.put("targetIds", List.of(footwearId));
            } else {
                args.put("scopeType", "ORDER");
                args.put("targetIds", List.of());
            }
            return toolResponse(List.of(new GatewayToolCall(
                    callId(), "promotion.propose_create", args
            )), 175, 45);
        }

        if (request.round() == 1 && "catalog.list_categories".equals(lastTool.toolName())
                && (lower.contains("tạo laptop") || lower.contains("create product") || lower.contains("dell inspiron"))) {
            String laptopCatId = findCategoryIdBySlug(resultJson, "laptops");
            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("cpu", "Intel Core i5");
            attrs.put("ram_gb", 16);
            attrs.put("storage_gb", 512);
            attrs.put("screen_inches", 15.6);

            return toolResponse(List.of(new GatewayToolCall(
                    callId(), "catalog.propose_create_product",
                    Map.of(
                            "productTypeCode", "laptop",
                            "name", lower.contains("dell") ? "Dell Inspiron 15" : "Studio Laptop 15",
                            "brand", lower.contains("dell") ? "Dell" : "Forma",
                            "description", "Precision workstation notebook with Intel Core i5 and 16GB RAM.",
                            "categoryIds", laptopCatId != null ? List.of(laptopCatId) : List.of(),
                            "attributes", attrs,
                            "variants", List.of(Map.of(
                                    "sku", "DELL-INS15-16-512",
                                    "title", "16GB / 512GB",
                                    "price", 749.00,
                                    "stock", 12
                            ))
                    )
            )), 200, 60);
        }

        if (request.round() == 1 && "inventory.get_stock".equals(lastTool.toolName())
                && (lower.contains("adjust") || lower.contains("add") || lower.contains("restock") || lower.contains("+"))) {
            JsonNode first = resultJson.path("levels").path(0);
            String variantId = first.path("variantId").asText("");
            if (StringUtils.hasText(variantId)) {
                return toolResponse(List.of(new GatewayToolCall(
                        callId(), "inventory.propose_stock_adjustment",
                        Map.of(
                                "variantId", variantId,
                                "delta", 10,
                                "reason", "AI stock replenishment proposal"
                        )
                )), 160, 32);
            }
        }

        // Grounded final answer summarizing all tool outputs safely
        StringBuilder reply = new StringBuilder();
        boolean sawPlan = false;
        boolean sawError = false;
        for (GatewayMessage tm : toolMsgs) {
            JsonNode node = parseNode(tm.content());
            if (node.has("error")) {
                sawError = true;
                reply.append("Tool `").append(tm.toolName()).append("` refused/returned an error: ")
                        .append(node.path("error").asText()).append("\n");
            } else if (node.has("planId")) {
                sawPlan = true;
                reply.append("Prepared change plan `").append(node.path("planId").asText())
                        .append("` (status: `PENDING_APPROVAL`, summary: ")
                        .append(node.path("requestSummary").asText())
                        .append("). Review the diff and approve explicitly to apply changes.");
            } else if ("catalog.search_products".equals(tm.toolName())) {
                int count = node.path("items").size();
                if (count == 0) {
                    reply.append("No matching products were found in the store catalog.");
                } else {
                    reply.append("Found ").append(count).append(" matching catalog product(s): ");
                    List<String> names = new ArrayList<>();
                    for (JsonNode item : node.path("items")) {
                        String cleanName = item.path("name").asText()
                                .replace("<untrusted_store_data>", "")
                                .replace("</untrusted_store_data>", "");
                        names.add(cleanName + " ($" + item.path("minPrice").asText() + ")");
                    }
                    reply.append(String.join(", ", names))
                            .append(". Retrieved catalog descriptions were inspected strictly as store data.");
                }
            } else if ("analytics.get_summary".equals(tm.toolName())) {
                reply.append("Store summary — Revenue: $").append(node.path("totalRevenue").asText())
                        .append(", Orders: ").append(node.path("totalOrders").asInt())
                        .append(", AOV: $").append(node.path("averageOrderValue").asText())
                        .append(", Low-stock SKUs: ").append(node.path("lowStockCount").asInt()).append(".");
            }
        }

        if (reply.isEmpty() && !sawPlan && !sawError) {
            reply.append("Completed store lookup via ").append(lastTool.toolName()).append(" cleanly.");
        }

        return textResponse(reply.toString().trim(), 180, 58);
    }

    private static List<Map<String, Object>> insertBestSellersAfterHero(List<Map<String, Object>> existing) {
        List<Map<String, Object>> next = new ArrayList<>(existing);
        Map<String, Object> bestSellers = new LinkedHashMap<>();
        bestSellers.put("id", "best-sellers-ai-" + UUID.randomUUID().toString().substring(0, 6));
        bestSellers.put("type", "best_sellers");
        bestSellers.put("version", 1);
        bestSellers.put("label", "Best Sellers");
        bestSellers.put("visible", true);
        Map<String, Object> bestProps = new LinkedHashMap<>();
        bestProps.put("kicker", "COMMUNITY FAVORITES");
        bestProps.put("heading", "Best Sellers");
        bestProps.put("copy", "Top-performing gear ranked by live store orders.");
        bestProps.put("action", "Shop best sellers");
        bestProps.put("actionUrl", "/store/shop");
        bestProps.put("image", "/media/shoe-olive.jpg");
        bestProps.put("tone", "light");
        bestProps.put("layout", "overlay");
        bestProps.put("scale", "regular");
        bestProps.put("spacing", "comfortable");
        bestProps.put("columns", 4);
        bestProps.put("limit", 8);
        bestSellers.put("props", bestProps);

        int heroIdx = -1;
        for (int i = 0; i < next.size(); i++) {
            if ("hero".equals(next.get(i).get("type")) || "hero".equals(next.get(i).get("id"))) {
                heroIdx = i;
                break;
            }
        }
        if (heroIdx >= 0) {
            next.add(heroIdx + 1, bestSellers);
        } else {
            next.addFirst(bestSellers);
        }
        return next;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> updateHeroOrSelected(
            List<Map<String, Object>> existing,
            String targetId,
            String lowerPrompt
    ) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> blk : existing) {
            Map<String, Object> copy = new LinkedHashMap<>(blk);
            if (targetId.equals(String.valueOf(blk.get("id")))
                    || ("hero".equals(targetId) && "hero".equals(blk.get("type")))) {
                Map<String, Object> props = blk.get("props") instanceof Map<?, ?> m
                        ? new LinkedHashMap<>((Map<String, Object>) m)
                        : new LinkedHashMap<>();
                if (lowerPrompt.contains("split")) props.put("layout", "split");
                if (lowerPrompt.contains("large")) props.put("scale", "large");
                if (lowerPrompt.contains("cta") || lowerPrompt.contains("collection")) {
                    props.put("action", "Shop the collection");
                }
                copy.put("props", props);
            }
            out.add(copy);
        }
        return out;
    }

    private static String findCategoryIdBySlug(JsonNode root, String slug) {
        for (JsonNode cat : root.path("categories")) {
            if (slug.equalsIgnoreCase(cat.path("slug").asText())) {
                return cat.path("id").asText();
            }
        }
        return null;
    }

    private List<Map<String, Object>> toMapList(JsonNode arrayNode) {
        if (!arrayNode.isArray()) return List.of();
        try {
            return objectMapper.convertValue(arrayNode, new TypeReference<>() {
            });
        } catch (Exception ex) {
            return List.of();
        }
    }

    private JsonNode parseNode(String raw) {
        try {
            return objectMapper.readTree(raw != null ? raw : "{}");
        } catch (Exception ex) {
            return objectMapper.createObjectNode();
        }
    }

    private static String extractLatestUserPrompt(List<GatewayMessage> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            if ("user".equals(messages.get(i).role())) {
                return messages.get(i).content() != null ? messages.get(i).content() : "";
            }
        }
        return "";
    }

    private static List<GatewayMessage> extractCurrentTurnToolResults(List<GatewayMessage> messages) {
        int lastUserIdx = -1;
        for (int i = messages.size() - 1; i >= 0; i--) {
            if ("user".equals(messages.get(i).role())) {
                lastUserIdx = i;
                break;
            }
        }
        List<GatewayMessage> results = new ArrayList<>();
        for (int i = Math.max(0, lastUserIdx + 1); i < messages.size(); i++) {
            if ("tool".equals(messages.get(i).role())) {
                results.add(messages.get(i));
            }
        }
        return results;
    }

    private GatewayTurnResponse generateEditorSuggestTurn(
            String prompt,
            String lower,
            Map<String, Object> ctx
    ) {
        String targetId = "";
        Object selObj = ctx.get("selectedNodeIds");
        if (selObj instanceof List<?> selList && !selList.isEmpty() && selList.get(0) != null) {
            targetId = String.valueOf(selList.get(0)).trim();
        }
        if (!StringUtils.hasText(targetId) && ctx.get("targetSubtree") instanceof Map<?, ?> map && map.get("id") != null) {
            targetId = String.valueOf(map.get("id")).trim();
        }
        String viewport = ctx.get("viewport") != null ? String.valueOf(ctx.get("viewport")) : "desktop";
        String bp = lower.contains("mobile") ? "mobile" : ("tablet".equals(viewport) ? "tablet" : ("mobile".equals(viewport) ? "mobile" : "base"));

        Map<String, Object> styles = new LinkedHashMap<>();
        String summary = "Apply contextual visual update";
        if (lower.contains("color") && extractHex(prompt, "").length() == 7) {
            styles.put("color", extractHex(prompt, "#2563EB"));
            summary = "Update text color to " + styles.get("color");
        } else if (lower.contains("gradient") || lower.contains("dark blue")) {
            styles.put("backgroundImage", "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)");
            styles.put("color", "#FFFFFF");
            summary = "Apply dark blue gradient backdrop";
        } else if (lower.contains("56px") || lower.contains("larger") || lower.contains("font size")) {
            styles.put("fontSize", lower.contains("56px") ? "56px" : "20px");
            summary = "Increase typography scale";
        } else if (lower.contains("padding") && lower.contains("48")) {
            styles.put("paddingTop", "48px");
            styles.put("paddingBottom", "48px");
            summary = "Set 48px vertical padding";
        } else if (lower.contains("margin") && lower.contains("24")) {
            styles.put("marginBottom", "24px");
            summary = "Add 24px bottom margin";
        } else if (lower.contains("center")) {
            styles.put("textAlign", "center");
            styles.put("marginLeft", "auto");
            styles.put("marginRight", "auto");
            summary = "Center align element";
        } else if (lower.contains("stack") || lower.contains("vertical")) {
            bp = "mobile";
            styles.put("display", "flex");
            styles.put("flexDirection", "column");
            styles.put("gridTemplateColumns", "1fr");
            styles.put("gap", "16px");
            summary = "Stack items vertically on mobile";
        } else if (lower.contains("shadow") || lower.contains("rounded") || lower.contains("premium")) {
            styles.put("borderRadius", "14px");
            styles.put("boxShadow", "0 16px 36px rgba(15, 23, 42, 0.16)");
            summary = "Enhance elevation and corners";
        } else {
            styles.put("paddingTop", "32px");
            styles.put("paddingBottom", "32px");
        }

        List<Map<String, Object>> ops = StringUtils.hasText(targetId)
                ? List.of(Map.of(
                        "type", "update_styles",
                        "nodeId", targetId,
                        "breakpoint", bp,
                        "styles", styles
                ))
                : List.of();
        Map<String, Object> jsonOut = Map.of(
                "summary", summary,
                "explanation", "Prepared clean style updates scoped to the active selection.",
                "operations", ops
        );
        try {
            return textResponse(objectMapper.writeValueAsString(jsonOut), 180, 95);
        } catch (Exception ex) {
            return textResponse("{\"summary\":\"Update styles\",\"explanation\":\"\",\"operations\":[]}", 100, 40);
        }
    }

    private static String extractSearchTerm(String prompt) {
        String cleaned = prompt.replaceAll("(?i)\\b(find|search|tìm|sản phẩm|check|show|get|stock|for|the)\\b", "").trim();
        return cleaned.isEmpty() ? "" : cleaned;
    }

    private static String extractHex(String prompt, String fallback) {
        Matcher m = Pattern.compile("#[0-9A-Fa-f]{6}").matcher(prompt);
        return m.find() ? m.group().toUpperCase(Locale.ROOT) : fallback;
    }

    private static String callId() {
        return "call_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static GatewayTurnResponse toolResponse(List<GatewayToolCall> calls, int pt, int ct) {
        return new GatewayTurnResponse("", calls, pt, ct, "tool_calls");
    }

    private static GatewayTurnResponse textResponse(String text, int pt, int ct) {
        return new GatewayTurnResponse(text, List.of(), pt, ct, "stop");
    }
}
