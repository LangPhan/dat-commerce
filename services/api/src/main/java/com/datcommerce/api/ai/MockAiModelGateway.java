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
        if ("storefront_chat".equals(String.valueOf(ctx.get("mode")))) {
            return generateStorefrontTurn(request, prompt, lower, toolMsgs, ctx);
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
        String scope = ctx.get("scope") != null ? String.valueOf(ctx.get("scope")).toLowerCase(Locale.ROOT) : "element";
        String viewport = ctx.get("viewport") != null ? String.valueOf(ctx.get("viewport")) : "desktop";
        String bp = lower.contains("mobile") ? "mobile" : ("tablet".equals(viewport) ? "tablet" : ("mobile".equals(viewport) ? "mobile" : "base"));

        if ("typography".equals(scope) || (("page".equals(scope)) && (lower.contains("all headings") || lower.contains("global font") || lower.contains("typography preset")))) {
            return generateTypographySuggestTurn(lower);
        }

        if ("motion".equals(scope) || isMotionPrompt(lower)) {
            return generateMotionSuggestTurn(prompt, lower, targetId, scope);
        }

        if (ctx.get("storeData") instanceof Map<?, ?> storeData && isStoreDataDesignPrompt(lower)) {
            return generateStoreDataDesignTurn(lower, storeData);
        }

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

    private static boolean isStoreDataDesignPrompt(String lower) {
        return lower.contains("collection")
                || lower.contains("bộ sưu tập")
                || lower.contains("promo")
                || lower.contains("discount")
                || lower.contains("khuyến mãi")
                || lower.contains("mã giảm giá");
    }

    private GatewayTurnResponse generateStoreDataDesignTurn(String lower, Map<?, ?> storeData) {
        if (lower.contains("promo") || lower.contains("discount") || lower.contains("khuyến mãi") || lower.contains("mã giảm giá")) {
            String code = "WELCOME15";
            String title = "Limited-Time Store Offer";
            String subtitle = "Save on your next order with our active store discount.";
            if (storeData.get("promotions") instanceof List<?> promos && !promos.isEmpty() && promos.get(0) instanceof Map<?, ?> pr) {
                if (pr.get("code") != null) code = String.valueOf(pr.get("code"));
                if (pr.get("name") != null) title = String.valueOf(pr.get("name"));
                if (pr.get("value") != null) subtitle = "Use code " + code + " at checkout to save " + pr.get("value") + ".";
            }
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", "sec_promo_" + UUID.randomUUID().toString().substring(0, 6));
            node.put("type", "promotion_banner");
            node.put("label", "Active Promotion Banner");
            node.put("visible", true);
            node.put("locked", false);
            node.put("props", Map.of(
                    "eyebrow", "ACTIVE OFFER · CODE " + code,
                    "title", title,
                    "subtitle", subtitle,
                    "ctaLabel", "Shop Offer",
                    "ctaHref", "/store/shop"
            ));
            node.put("styles", Map.of("base", Map.of("paddingTop", "48px", "paddingBottom", "48px")));
            Map<String, Object> op = new LinkedHashMap<>();
            op.put("type", "insert_node");
            op.put("parentId", null);
            op.put("index", 1);
            op.put("node", node);
            try {
                return textResponse(objectMapper.writeValueAsString(Map.of(
                        "summary", "Add live promotion banner (" + code + ")",
                        "explanation", "Created a promotional banner grounded in your active store discount code " + code + ".",
                        "operations", List.of(op)
                )), 210, 140);
            } catch (Exception ex) {
                return textResponse("{\"summary\":\"Promo banner\",\"explanation\":\"\",\"operations\":[]}", 60, 30);
            }
        }

        // Collections showcase grounded in real store collections & images
        List<Map<String, Object>> cards = new ArrayList<>();
        if (storeData.get("collections") instanceof List<?> cols) {
            int idx = 0;
            for (Object obj : cols) {
                if (!(obj instanceof Map<?, ?> c)) continue;
                String name = c.get("name") != null ? String.valueOf(c.get("name")) : "Collection";
                String slug = c.get("slug") != null ? String.valueOf(c.get("slug")) : "shop";
                String desc = c.get("description") != null && StringUtils.hasText(String.valueOf(c.get("description")))
                        ? String.valueOf(c.get("description"))
                        : (c.get("productCount") + " curated products");
                String cover = c.get("coverImage") != null ? String.valueOf(c.get("coverImage")) : "";

                List<Map<String, Object>> cardChildren = new ArrayList<>();
                if (StringUtils.hasText(cover)) {
                    cardChildren.add(Map.of(
                            "id", "col_img_" + idx,
                            "type", "image",
                            "label", name + " Cover",
                            "visible", true,
                            "locked", false,
                            "props", Map.of("src", cover, "alt", name, "href", "/store/shop?collection=" + slug),
                            "styles", Map.of("base", Map.of("borderRadius", "12px", "aspectRatio", "4 / 3", "objectFit", "cover", "width", "100%"))
                    ));
                }
                cardChildren.add(Map.of(
                        "id", "col_h_" + idx,
                        "type", "heading",
                        "label", name + " Title",
                        "visible", true,
                        "locked", false,
                        "props", Map.of("text", name, "tag", "h3", "href", "/store/shop?collection=" + slug),
                        "styles", Map.of("base", Map.of("fontSize", "20px", "fontWeight", "600", "marginTop", "12px"))
                ));
                cardChildren.add(Map.of(
                        "id", "col_p_" + idx,
                        "type", "text_editor",
                        "label", name + " Description",
                        "visible", true,
                        "locked", false,
                        "props", Map.of("text", desc),
                        "styles", Map.of("base", Map.of("fontSize", "14px", "marginTop", "4px"))
                ));
                cardChildren.add(Map.of(
                        "id", "col_btn_" + idx,
                        "type", "button",
                        "label", "Explore " + name,
                        "visible", true,
                        "locked", false,
                        "props", Map.of("label", "Explore " + name, "href", "/store/shop?collection=" + slug, "variant", "secondary"),
                        "styles", Map.of("base", Map.of("marginTop", "12px"))
                ));

                cards.add(Map.of(
                        "id", "col_card_" + idx,
                        "type", "container",
                        "label", name + " Card",
                        "visible", true,
                        "locked", false,
                        "props", Map.of(),
                        "styles", Map.of("base", Map.of(
                                "padding", "18px",
                                "borderRadius", "16px",
                                "borderWidth", "1px",
                                "borderStyle", "solid",
                                "borderColor", "#E5E7EB",
                                "backgroundColor", "#FFFFFF"
                        )),
                        "children", cardChildren
                ));
                idx++;
                if (idx >= 6) break;
            }
        }

        String secId = "sec_collections_" + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> gridNode = Map.of(
                "id", secId + "_grid",
                "type", "grid",
                "label", "Collections Grid",
                "visible", true,
                "locked", false,
                "props", Map.of("columns", Math.min(3, Math.max(1, cards.size()))),
                "styles", Map.of(
                        "base", Map.of("display", "grid", "gridTemplateColumns", "repeat(3, minmax(0, 1fr))", "gap", "20px", "marginTop", "24px"),
                        "mobile", Map.of("gridTemplateColumns", "1fr")
                ),
                "children", cards
        );
        Map<String, Object> sectionNode = Map.of(
                "id", secId,
                "type", "section",
                "label", "Curated Collections Showcase",
                "visible", true,
                "locked", false,
                "props", Map.of(),
                "styles", Map.of("base", Map.of("paddingTop", "56px", "paddingBottom", "56px")),
                "children", List.of(Map.of(
                        "id", secId + "_inner",
                        "type", "container",
                        "label", "Collections Container",
                        "visible", true,
                        "locked", false,
                        "props", Map.of(),
                        "styles", Map.of("base", Map.of("maxWidth", "1280px", "marginLeft", "auto", "marginRight", "auto")),
                        "children", List.of(
                                Map.of(
                                        "id", secId + "_heading",
                                        "type", "heading",
                                        "label", "Collections Heading",
                                        "visible", true,
                                        "locked", false,
                                        "props", Map.of("text", "Shop by Collection", "tag", "h2"),
                                        "styles", Map.of("base", Map.of("fontSize", "32px", "fontWeight", "700"))
                                ),
                                gridNode
                        )
                ))
        );
        Map<String, Object> op = new LinkedHashMap<>();
        op.put("type", "insert_node");
        op.put("parentId", null);
        op.put("index", 1);
        op.put("node", sectionNode);
        try {
            return textResponse(objectMapper.writeValueAsString(Map.of(
                    "summary", "Design Curated Collections section (" + cards.size() + " collections)",
                    "explanation", "Built a responsive Collections showcase populated directly with your live store collections, descriptions, and cover images.",
                    "operations", List.of(op)
            )), 260, 220);
        } catch (Exception ex) {
            return textResponse("{\"summary\":\"Collections showcase\",\"explanation\":\"\",\"operations\":[]}", 60, 30);
        }
    }

    private static boolean isMotionPrompt(String lower) {
        return lower.contains("animate")
                || lower.contains("animation")
                || lower.contains("fade in")
                || lower.contains("slide in")
                || lower.contains("zoom in")
                || lower.contains("bounce")
                || lower.contains("parallax")
                || lower.contains("hover")
                || lower.contains("stagger")
                || lower.contains("floating")
                || lower.contains("pulse")
                || lower.contains("word by word")
                || lower.contains("word-by-word")
                || lower.contains("typing effect")
                || lower.contains("reduced motion")
                || lower.contains("disable animation")
                || lower.contains("remove animation")
                || lower.contains("motion");
    }

    private GatewayTurnResponse generateMotionSuggestTurn(
            String prompt,
            String lower,
            String targetId,
            String scope
    ) {
        String summary;
        String explanation;
        List<Map<String, Object>> ops = new ArrayList<>();

        if ("motion".equals(scope) || lower.contains("global motion") || lower.contains("reduced motion") || lower.contains("across the site")) {
            Map<String, Object> gm = new LinkedHashMap<>();
            if (lower.contains("disable") || lower.contains("turn off")) {
                gm.put("enabled", false);
                summary = "Disable animations globally";
                explanation = "Turned off storefront animations globally while preserving individual element configurations.";
            } else if (lower.contains("mobile") && lower.contains("reduce")) {
                gm.put("mobileBehavior", "reduced");
                summary = "Reduce animation intensity on mobile";
                explanation = "Set mobile behavior to reduced so entrance durations shorten and heavy parallax/loops stay off on mobile.";
            } else {
                gm.put("enabled", true);
                gm.put("defaultDuration", lower.contains("fast") || lower.contains("snappy") ? 360 : 520);
                gm.put("defaultEasing", "easeOut");
                gm.put("mobileBehavior", "reduced");
                summary = "Apply refined global motion defaults";
                explanation = "Updated global motion defaults with smooth easeOut timing and mobile-friendly reduced motion.";
            }
            ops.add(Map.of("type", "update_global_motion", "motion", gm));
        } else if (StringUtils.hasText(targetId) && (lower.contains("remove animation") || lower.contains("clear animation"))) {
            ops.add(Map.of("type", "remove_element_animation", "nodeId", targetId, "category", "all"));
            summary = "Remove element animations";
            explanation = "Cleared all animation configurations from the selected element.";
        } else if (StringUtils.hasText(targetId) && lower.contains("mobile") && (lower.contains("disable") || lower.contains("turn off"))) {
            ops.add(Map.of(
                    "type", "update_responsive_animation",
                    "nodeId", targetId,
                    "breakpoint", "mobile",
                    "override", Map.of("enabled", false)
            ));
            summary = "Disable animation on mobile";
            explanation = "Added a mobile breakpoint override disabling animations on small viewports.";
        } else if (StringUtils.hasText(targetId) && (lower.contains("word by word") || lower.contains("word-by-word") || lower.contains("typing"))) {
            String preset = lower.contains("typing") ? "typingEffect" : "staggerWord";
            ops.add(Map.of(
                    "type", "update_element_animation",
                    "nodeId", targetId,
                    "motion", Map.of(
                            "enabled", true,
                            "text", Map.of("enabled", true, "preset", preset, "staggerMs", 55, "duration", 520, "trigger", "viewport")
                    )
            ));
            summary = "Animate text with " + preset;
            explanation = "Applied an accessible semantic text animation preserving screen-reader text.";
        } else if (StringUtils.hasText(targetId) && lower.contains("parallax")) {
            ops.add(Map.of(
                    "type", "update_element_animation",
                    "nodeId", targetId,
                    "motion", Map.of(
                            "enabled", true,
                            "scroll", Map.of("enabled", true, "mode", "parallax", "effect", "parallaxVertical", "speed", 36, "intensity", 36)
                    )
            ));
            summary = "Add subtle vertical parallax";
            explanation = "Configured GPU-composited vertical scroll parallax on the selected element.";
        } else if (StringUtils.hasText(targetId) && lower.contains("hover")) {
            String hoverPreset = lower.contains("scale") ? "scaleUp" : (lower.contains("glow") ? "glow" : "moveUp");
            ops.add(Map.of(
                    "type", "update_element_animation",
                    "nodeId", targetId,
                    "motion", Map.of(
                            "enabled", true,
                            "hover", Map.of("enabled", true, "preset", hoverPreset, "duration", 220, "easing", "easeOut")
                    )
            ));
            summary = "Add hover " + hoverPreset + " effect";
            explanation = "Added a smooth pointer-only hover transition with touch-device safety.";
        } else if (StringUtils.hasText(targetId) && lower.contains("stagger")) {
            ops.add(Map.of(
                    "type", "update_element_animation",
                    "nodeId", targetId,
                    "motion", Map.of(
                            "enabled", true,
                            "stagger", Map.of("enabled", true, "preset", "fadeInUp", "interval", 90, "maxDelay", 650, "direction", "forward", "order", "sequential")
                    )
            ));
            summary = "Add staggered entrance to children";
            explanation = "Configured staggered fadeInUp reveals across child items with capped maximum delay.";
        } else if (StringUtils.hasText(targetId)) {
            String preset = lower.contains("zoom") ? "zoomIn"
                    : (lower.contains("slide") ? "slideInUp"
                    : (lower.contains("bounce") ? "bounceIn" : "fadeInUp"));
            int duration = lower.contains("800") ? 800 : (lower.contains("600") ? 600 : 550);
            ops.add(Map.of(
                    "type", "set_element_animation",
                    "nodeId", targetId,
                    "motion", Map.of(
                            "enabled", true,
                            "entrance", Map.of(
                                    "enabled", true,
                                    "preset", preset,
                                    "duration", duration,
                                    "delay", 0,
                                    "easing", "easeOut",
                                    "trigger", "viewport",
                                    "once", true
                            )
                    )
            ));
            summary = "Apply " + preset + " entrance (" + duration + "ms)";
            explanation = "Configured a smooth " + preset + " entrance animation on the selected element.";
        } else {
            summary = "Apply subtle global motion";
            explanation = "No element selected; updated global motion defaults.";
            ops.add(Map.of("type", "update_global_motion", "motion", Map.of("enabled", true, "defaultDuration", 520, "defaultEasing", "easeOut")));
        }

        try {
            String json = objectMapper.writeValueAsString(Map.of(
                    "summary", summary,
                    "explanation", explanation,
                    "operations", ops
            ));
            return textResponse(json, 190, 110);
        } catch (Exception ex) {
            return textResponse("{\"summary\":\"Motion update\",\"explanation\":\"\",\"operations\":[]}", 80, 40);
        }
    }

    private GatewayTurnResponse generateTypographySuggestTurn(String lower) {
        List<Map<String, Object>> ops = new ArrayList<>();
        String summary;
        String explanation;
        if (lower.contains("luxury") || lower.contains("editorial") || lower.contains("fashion") || lower.contains("playfair")) {
            ops.add(Map.of("type", "update_typography_font", "role", "heading", "family", "Playfair Display", "fallback", "serif"));
            ops.add(Map.of("type", "update_typography_font", "role", "body", "family", "Inter", "fallback", "sans-serif"));
            ops.add(Map.of("type", "update_typography_preset", "target", "h1", "property", "fontWeight", "value", 600));
            summary = "Apply editorial Playfair Display & Inter typography";
            explanation = "Updated Heading font to Playfair Display, Body font to Inter, and refined H1 weight to 600.";
        } else if (lower.contains("all headings") || lower.contains("headings")) {
            Map<String, String> h1Sizes = Map.of("desktop", "42px", "tablet", "34px", "mobile", "28px");
            Map<String, String> h2Sizes = Map.of("desktop", "32px", "tablet", "26px", "mobile", "22px");
            Map<String, String> h3Sizes = Map.of("desktop", "24px", "tablet", "21px", "mobile", "19px");
            ops.add(Map.of("type", "update_typography_preset", "target", "h1", "property", "fontSize", "responsiveValues", h1Sizes));
            ops.add(Map.of("type", "update_typography_preset", "target", "h2", "property", "fontSize", "responsiveValues", h2Sizes));
            ops.add(Map.of("type", "update_typography_preset", "target", "h3", "property", "fontSize", "responsiveValues", h3Sizes));
            for (String h : List.of("h1", "h2", "h3", "h4", "h5", "h6")) {
                ops.add(Map.of("type", "update_typography_preset", "target", h, "property", "fontWeight", "value", 600));
            }
            summary = "Scale down headings and set weight 600";
            explanation = "Updated H1-H3 responsive sizes, set H1-H6 weight to 600, and preserved body and caption styles.";
        } else {
            ops.add(Map.of("type", "update_typography_preset", "target", "body", "property", "lineHeight", "value", 1.7));
            summary = "Refine global body line height";
            explanation = "Updated Body line height to 1.7 for improved storefront readability.";
        }
        Map<String, Object> jsonOut = Map.of("summary", summary, "explanation", explanation, "operations", ops);
        try {
            return textResponse(objectMapper.writeValueAsString(jsonOut), 190, 110);
        } catch (Exception ex) {
            return textResponse("{\"summary\":\"Update typography\",\"explanation\":\"\",\"operations\":[]}", 100, 40);
        }
    }


    private GatewayTurnResponse generateStorefrontTurn(
            GatewayRequest request,
            String prompt,
            String lower,
            List<GatewayMessage> toolMsgs,
            Map<String, Object> ctx
    ) {
        if (toolMsgs.isEmpty()) {
            if (lower.contains("prefill") || lower.contains("checkout") || lower.contains("đặt hàng")
                    || lower.contains("điền thông tin") || lower.contains("giao đến") || lower.contains("address")
                    || lower.contains("địa chỉ")) {
                Map<String, Object> args = new LinkedHashMap<>();
                args.put("customerName", String.valueOf(ctx.getOrDefault("customerName", "Samir Patel")));
                args.put("customerEmail", String.valueOf(ctx.getOrDefault("customerEmail", "customer@datcommerce.local")));
                args.put("line1", lower.contains("nguyen hue") ? "123 Nguyen Hue" : "742 Evergreen Terrace");
                args.put("city", lower.contains("ho chi minh") || lower.contains("hcm") ? "Ho Chi Minh City" : "Seattle");
                args.put("state", lower.contains("ho chi minh") || lower.contains("hcm") ? "HCM" : "WA");
                args.put("postalCode", lower.contains("700000") ? "700000" : "98101");
                args.put("shippingMethod", lower.contains("express") || lower.contains("nhanh") ? "express" : "standard");
                if (lower.contains("welcome15")) {
                    args.put("promotionCode", "WELCOME15");
                }
                return toolResponse(List.of(new GatewayToolCall(callId(), "shop.prefill_checkout", args)), 120, 40);
            }
            if (lower.contains("promo") || lower.contains("discount") || lower.contains("coupon")
                    || lower.contains("khuyến mãi") || lower.contains("giảm giá") || lower.contains("mã giảm")) {
                return toolResponse(List.of(new GatewayToolCall(callId(), "shop.list_active_promotions", Map.of())), 95, 22);
            }
            String slug = ctx.get("productSlug") != null ? String.valueOf(ctx.get("productSlug")) : "";
            if (StringUtils.hasText(slug) && !(lower.contains("add to cart") || lower.contains("thêm vào giỏ"))) {
                return toolResponse(List.of(new GatewayToolCall(callId(), "shop.get_product_details", Map.of("slugOrQuery", slug))), 105, 24);
            }
            String q = extractSearchTerm(prompt);
            Map<String, Object> searchArgs = new LinkedHashMap<>();
            searchArgs.put("q", q);
            searchArgs.put("limit", 4);
            return toolResponse(List.of(new GatewayToolCall(callId(), "shop.search_products", searchArgs)), 105, 24);
        }

        GatewayMessage lastTool = toolMsgs.getLast();
        JsonNode result = parseNode(lastTool.content());

        if (request.round() == 1 && "shop.search_products".equals(lastTool.toolName())
                && (lower.contains("add to cart") || lower.contains("thêm vào giỏ") || lower.contains("bỏ vào giỏ"))) {
            JsonNode products = result.path("products");
            if (products.isArray() && !products.isEmpty()) {
                JsonNode first = products.get(0);
                JsonNode variants = first.path("variants");
                if (variants.isArray() && !variants.isEmpty()) {
                    String variantId = variants.get(0).path("variantId").asText("");
                    if (StringUtils.hasText(variantId)) {
                        return toolResponse(List.of(new GatewayToolCall(
                                callId(),
                                "shop.add_to_cart",
                                Map.of("variantId", variantId, "quantity", 1)
                        )), 125, 30);
                    }
                }
            }
        }

        if ("shop.prefill_checkout".equals(lastTool.toolName())) {
            return textResponse(
                    "I have prefilled your checkout details for review. Please click **Review & Place Order** to verify and submit your order yourself.",
                    135, 36
            );
        }
        if ("shop.add_to_cart".equals(lastTool.toolName())) {
            int count = result.path("cartItemCount").asInt(1);
            return textResponse(
                    "Added to your cart! You now have **" + count + "** item(s) ready in your bag.",
                    130, 32
            );
        }
        if ("shop.list_active_promotions".equals(lastTool.toolName())) {
            JsonNode promos = result.path("promotions");
            if (promos.isArray() && !promos.isEmpty()) {
                StringBuilder sb = new StringBuilder("Here are the active store promotions:\n\n| Code | Offer | Type |\n|---|---|---|\n");
                for (JsonNode pr : promos) {
                    sb.append("| `").append(pr.path("code").asText()).append("` | ")
                            .append(pr.path("name").asText()).append(" | ")
                            .append(pr.path("type").asText()).append(" ").append(pr.path("value").asText()).append(" |\n");
                }
                return textResponse(sb.toString(), 130, 48);
            }
            return textResponse("There are currently no active promotion codes.", 90, 20);
        }

        JsonNode products = result.path("products");
        if (products.isArray() && !products.isEmpty()) {
            StringBuilder sb = new StringBuilder("Here are recommended products matching your request:\n\n| Product | Price | Stock |\n|---|---:|---:|\n");
            for (JsonNode prod : products) {
                sb.append("| ").append(prod.path("name").asText())
                        .append(" | $").append(prod.path("minPrice").asText())
                        .append(" | ").append(prod.path("totalStock").asInt(0)).append(" |\n");
            }
            return textResponse(sb.toString(), 140, 56);
        }
        JsonNode single = result.path("product");
        if (!single.isMissingNode() && single.has("name")) {
            return textResponse(
                    "**" + single.path("name").asText() + "** (" + single.path("brand").asText() + ") — $"
                            + single.path("minPrice").asText() + ", Stock: " + single.path("totalStock").asInt(0),
                    125, 34
            );
        }
        return textResponse("I checked the live catalog — let me know which item you want to inspect or add to your cart.", 95, 26);
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
