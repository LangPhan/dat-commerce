package com.datcommerce.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommerceCheckoutAndOrdersIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void checkoutEnforcesStockServerPricingIdempotencyOrderSnapshotAndCancelFlow() throws Exception {
        String ownerToken = login("owner@datcommerce.local", "OwnerPass123!");
        String viewerToken = login("viewer@datcommerce.local", "ViewerPass123!");

        // 1. Fetch Ridge Runner GTX from store API
        MvcResult prodRes = mockMvc.perform(get("/api/v1/store/products/ridge-runner-gtx"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode product = objectMapper.readTree(prodRes.getResponse().getContentAsString());
        JsonNode firstVariant = product.get("variants").get(0);
        String variantId = firstVariant.get("id").asText();
        BigDecimal initialPrice = new BigDecimal(firstVariant.get("price").asText());
        int initialStock = firstVariant.get("availableStock").asInt();

        String cartSession = "sess-" + UUID.randomUUID();

        // 2. Overselling prevented
        mockMvc.perform(post("/api/v1/store/cart/items")
                        .header("X-Cart-Session", cartSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "variantId", variantId,
                                "quantity", initialStock + 50
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        // 3. Add 2 units + apply TRAIL10 (10%)
        mockMvc.perform(post("/api/v1/store/cart/items")
                        .header("X-Cart-Session", cartSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "variantId", variantId,
                                "quantity", 2
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].quantity").value(2));

        mockMvc.perform(post("/api/v1/store/cart/promotion")
                        .header("X-Cart-Session", cartSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "TRAIL10"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.promotionCode").value("TRAIL10"));

        // 4. Checkout with Idempotency-Key (forged client fields ignored by DTO/backend)
        String idemKey = "idem-" + UUID.randomUUID();
        Map<String, Object> checkoutPayload = Map.of(
                "customerName", "Taylor Creek",
                "customerEmail", "taylor@example.com",
                "shippingMethod", "standard",
                "address", Map.of(
                        "line1", "99 Alpine Way",
                        "city", "Bend",
                        "state", "OR",
                        "postalCode", "97701",
                        "country", "US"
                )
        );

        MvcResult checkoutRes = mockMvc.perform(post("/api/v1/store/checkout")
                        .header("X-Cart-Session", cartSession)
                        .header("Idempotency-Key", idemKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(checkoutPayload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.promotionCode").value("TRAIL10"))
                .andReturn();

        JsonNode order = objectMapper.readTree(checkoutRes.getResponse().getContentAsString());
        String orderId = order.get("id").asText();
        String orderNumber = order.get("orderNumber").asText();
        BigDecimal expectedSub = initialPrice.multiply(BigDecimal.valueOf(2));
        BigDecimal expectedDisc = expectedSub.multiply(new BigDecimal("0.10")).setScale(2, java.math.RoundingMode.HALF_UP);
        assertThat(new BigDecimal(order.get("subtotal").asText())).isEqualByComparingTo(expectedSub);
        assertThat(new BigDecimal(order.get("discountTotal").asText())).isEqualByComparingTo(expectedDisc);
        assertThat(new BigDecimal(order.get("grandTotal").asText())).isEqualByComparingTo(expectedSub.subtract(expectedDisc));

        // 5. Idempotent retry returns the exact same order without double stock deduction
        MvcResult retryRes = mockMvc.perform(post("/api/v1/store/checkout")
                        .header("X-Cart-Session", cartSession)
                        .header("Idempotency-Key", idemKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(checkoutPayload)))
                .andExpect(status().isCreated())
                .andReturn();
        assertThat(objectMapper.readTree(retryRes.getResponse().getContentAsString()).get("orderNumber").asText())
                .isEqualTo(orderNumber);

        MvcResult afterStockRes = mockMvc.perform(get("/api/v1/store/products/ridge-runner-gtx"))
                .andExpect(status().isOk())
                .andReturn();
        int stockAfterCheckout = objectMapper.readTree(afterStockRes.getResponse().getContentAsString())
                .get("variants").get(0).get("availableStock").asInt();
        assertThat(stockAfterCheckout).isEqualTo(initialStock - 2);

        // 6. Updating variant price does NOT alter order_items unitPrice snapshot
        BigDecimal newPrice = initialPrice.add(new BigDecimal("50.00"));
        mockMvc.perform(patch("/api/v1/admin/variants/" + variantId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("price", newPrice))))
                .andExpect(status().isOk());

        MvcResult orderSnapshotRes = mockMvc.perform(get("/api/v1/admin/orders/" + orderId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();
        BigDecimal snapPrice = new BigDecimal(objectMapper.readTree(orderSnapshotRes.getResponse().getContentAsString())
                .get("items").get(0).get("unitPrice").asText());
        assertThat(snapPrice).isEqualByComparingTo(initialPrice);

        // Restore variant price cleanly
        mockMvc.perform(patch("/api/v1/admin/variants/" + variantId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("price", initialPrice))))
                .andExpect(status().isOk());

        // 7. Valid state transitions + invalid transition rejected
        mockMvc.perform(patch("/api/v1/admin/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "PROCESSING"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PROCESSING"));

        mockMvc.perform(patch("/api/v1/admin/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CONFIRMED"))))
                .andExpect(status().isBadRequest());

        // 8. VIEWER cannot cancel order; OWNER can cancel and stock is restored
        mockMvc.perform(post("/api/v1/admin/orders/" + orderId + "/cancel")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Attempt"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/admin/orders/" + orderId + "/cancel")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Customer requested cancel"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELED"))
                .andExpect(jsonPath("$.paymentStatus").value("REFUNDED"));

        MvcResult restoredStockRes = mockMvc.perform(get("/api/v1/store/products/ridge-runner-gtx"))
                .andExpect(status().isOk())
                .andReturn();
        int stockAfterCancel = objectMapper.readTree(restoredStockRes.getResponse().getContentAsString())
                .get("variants").get(0).get("availableStock").asInt();
        assertThat(stockAfterCancel).isEqualTo(initialStock);

        // 9. Analytics summary returns live figures
        mockMvc.perform(get("/api/v1/admin/analytics/summary")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productCount").value(12))
                .andExpect(jsonPath("$.totalOrders").isNumber());
    }

    private String login(String email, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", password
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("accessToken").asText();
    }
}
