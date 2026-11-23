package com.datcommerce.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.datcommerce.api.ai.AiModelGateway;
import com.datcommerce.api.ai.NineRouterAiGateway;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureObservability
@ActiveProfiles("test")
class HardeningAndObservabilityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private NineRouterAiGateway nineRouterGateway;

    @Autowired
    private AppProperties appProperties;

    @Test
    void nineRouterGatewayRetriesAndFallsBackAndOpensCircuitBreaker() throws Exception {
        AppProperties.Ai ai = appProperties.getAi();
        String origBaseUrl = ai.getBaseUrl();
        String origApiKey = ai.getApiKey();
        String origDefault = ai.getDefaultModel();
        String origFast = ai.getFastTaskModel();
        int origRetries = ai.getRetryMaxAttempts();
        int origThreshold = ai.getCircuitBreakerThreshold();
        int origOpenSec = ai.getCircuitBreakerOpenSeconds();

        AtomicReference<String> mode = new AtomicReference<>("transient503");
        AtomicInteger callCount = new AtomicInteger(0);

        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            int seq = callCount.incrementAndGet();
            String bodyRaw = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            JsonNode reqJson = objectMapper.readTree(bodyRaw);
            String requestedModel = reqJson.path("model").asText("");

            String m = mode.get();
            byte[] out;
            int statusCode;
            if ("transient503".equals(m)) {
                if (seq == 1) {
                    statusCode = 503;
                    out = "{\"error\":\"temporary unavailable\"}".getBytes(StandardCharsets.UTF_8);
                } else {
                    statusCode = 200;
                    out = """
                            {"choices":[{"finish_reason":"stop","message":{"content":"retried-ok"}}],"usage":{"prompt_tokens":12,"completion_tokens":4}}
                            """.getBytes(StandardCharsets.UTF_8);
                }
            } else if ("fallback".equals(m)) {
                if ("claude-sonnet-4".equals(requestedModel)) {
                    statusCode = 502;
                    out = "{\"error\":\"primary model error\"}".getBytes(StandardCharsets.UTF_8);
                } else {
                    statusCode = 200;
                    out = """
                            {"choices":[{"finish_reason":"stop","message":{"content":"fallback-ok"}}],"usage":{"prompt_tokens":15,"completion_tokens":5}}
                            """.getBytes(StandardCharsets.UTF_8);
                }
            } else {
                statusCode = 503;
                out = "{\"error\":\"down\"}".getBytes(StandardCharsets.UTF_8);
            }

            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(statusCode, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();

        try {
            ai.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            ai.setApiKey("test-key-not-logged");
            ai.setDefaultModel("claude-sonnet-4");
            ai.setFastTaskModel("forma-fast");
            ai.setRetryMaxAttempts(3);
            ai.setCircuitBreakerThreshold(2);
            ai.setCircuitBreakerOpenSeconds(30);
            nineRouterGateway.setRetryBaseDelayMsForTests(5);
            nineRouterGateway.resetCircuitBreakerForTests();

            AiModelGateway.GatewayRequest gwReq = new AiModelGateway.GatewayRequest(
                    "claude-sonnet-4",
                    List.of(AiModelGateway.GatewayMessage.user("hello")),
                    List.of(),
                    Map.of(),
                    256,
                    0
            );

            // 1. Transient 503 succeeds on retry
            AiModelGateway.GatewayTurnResponse retried = nineRouterGateway.generateTurn(gwReq);
            assertThat(retried.content()).isEqualTo("retried-ok");
            assertThat(callCount.get()).isEqualTo(2);

            // 2. Primary model 502 triggers fallback model ("forma-fast")
            mode.set("fallback");
            callCount.set(0);
            AiModelGateway.GatewayTurnResponse fallback = nineRouterGateway.generateTurn(gwReq);
            assertThat(fallback.content()).isEqualTo("fallback-ok");
            assertThat(callCount.get()).isEqualTo(4); // 3 primary retries + 1 fallback call

            // 3. Repeated failures open circuit breaker and fast-fail without hitting upstream
            mode.set("always503");
            callCount.set(0);
            for (int i = 0; i < 2; i++) {
                assertThatThrownBy(() -> nineRouterGateway.generateTurn(gwReq))
                        .isInstanceOf(ApiException.class)
                        .satisfies(ex -> assertThat(((ApiException) ex).getCode()).isEqualTo(ErrorCode.AI_GATEWAY_ERROR));
            }
            int hitsBeforeCircuitOpen = callCount.get();
            assertThat(hitsBeforeCircuitOpen).isGreaterThanOrEqualTo(4);

            assertThatThrownBy(() -> nineRouterGateway.generateTurn(gwReq))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("circuit breaker open");
            assertThat(callCount.get()).isEqualTo(hitsBeforeCircuitOpen);
        } finally {
            server.stop(0);
            nineRouterGateway.setRetryBaseDelayMsForTests(150);
            nineRouterGateway.resetCircuitBreakerForTests();
            ai.setBaseUrl(origBaseUrl);
            ai.setApiKey(origApiKey);
            ai.setDefaultModel(origDefault);
            ai.setFastTaskModel(origFast);
            ai.setRetryMaxAttempts(origRetries);
            ai.setCircuitBreakerThreshold(origThreshold);
            ai.setCircuitBreakerOpenSeconds(origOpenSec);
        }
    }

    @Test
    void loginRateLimiterAndPrometheusMetricsWork() throws Exception {
        String bruteEmail = "bruteforce-" + UUID.randomUUID().toString().substring(0, 8) + "@datcommerce.local";
        String badBody = objectMapper.writeValueAsString(Map.of(
                "email", bruteEmail,
                "password", "WrongPassword!"
        ));

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .with(req -> {
                                req.setRemoteAddr("10.9.9.9");
                                return req;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(badBody))
                    .andExpect(status().isUnauthorized());
        }

        // 11th failure must hit Redis brute-force rate limit (429)
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("10.9.9.9");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(badBody))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        // Valid owner login still succeeds cleanly
        MvcResult loginRes = mockMvc.perform(post("/api/v1/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("10.9.9.10");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "owner@datcommerce.local",
                                "password", "OwnerPass123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String ownerToken = objectMapper.readTree(loginRes.getResponse().getContentAsString())
                .get("accessToken").asText();

        // Trigger one AI turn so datcommerce_* counters/timers are emitted to Prometheus
        MvcResult convRes = mockMvc.perform(post("/api/v1/admin/ai/conversations")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Metrics check\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String convId = objectMapper.readTree(convRes.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(post("/api/v1/admin/ai/conversations/" + convId + "/messages")
                        .header("Authorization", "Bearer " + ownerToken)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prompt\":\"Analyze revenue performance\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        MvcResult promRes = mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andReturn();
        String metricsText = promRes.getResponse().getContentAsString();
        assertThat(metricsText).contains("jvm_memory_used_bytes");
        assertThat(metricsText).contains("datcommerce_ai_turns_total");
        assertThat(metricsText).contains("datcommerce_ai_tokens_prompt_total");
    }
}
