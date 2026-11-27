package com.datcommerce.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.datcommerce.api.experience.SeasonalExperienceScheduler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
class SeasonalExperienceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SeasonalExperienceScheduler scheduler;

    @Test
    void fullLifecycleSchedulingCompositionVersioningAiDesignAndRbacWork() throws Exception {
        String editorToken = login("editor@datcommerce.local", "EditorPass123!");
        String viewerToken = login("viewer@datcommerce.local", "ViewerPass123!");

        // 1. List 10 predefined templates
        mockMvc.perform(get("/api/v1/admin/experiences/templates")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(10));

        // 2. Create experience from Lunar New Year template
        MvcResult createLnyRes = mockMvc.perform(post("/api/v1/admin/experiences")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Tet Holiday Test",
                                "presetKey", "lunar-new-year",
                                "priority", 70,
                                "blendMode", "OVERRIDE"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("CULTURAL"))
                .andExpect(jsonPath("$.versions.length()").value(1))
                .andReturn();

        JsonNode lny = objectMapper.readTree(createLnyRes.getResponse().getContentAsString());
        String lnyId = lny.get("id").asText();
        String v1Id = lny.get("latestVersion").get("id").asText();
        long initialLockVer = lny.get("version").asLong();

        // 3. Reject XSS in version save
        mockMvc.perform(post("/api/v1/admin/experiences/" + lnyId + "/versions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "expectedVersion", initialLockVer,
                                "config", Map.of("layers", List.of(Map.of(
                                        "id", "bad",
                                        "type", "promo_banner",
                                        "label", "XSS",
                                        "props", Map.of("headline", "<script>alert(1)</script>")
                                )))
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // 4. AI Creative Director designs modifications cleanly
        MvcResult aiRes = mockMvc.perform(post("/api/v1/admin/experiences/ai/design")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "experienceId", lnyId,
                                "prompt", "Add golden particles and make it darker",
                                "currentConfig", objectMapper.convertValue(lny.get("latestVersion").get("config"), Map.class)
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.proposedConfig.layers").isArray())
                .andExpect(jsonPath("$.proposedConfig.themeOverride.mode").value("dark_luxe"))
                .andReturn();
        JsonNode aiDesign = objectMapper.readTree(aiRes.getResponse().getContentAsString());

        // 5. Save v2 with AI config & verify optimistic locking (409 on stale version)
        MvcResult v2Res = mockMvc.perform(post("/api/v1/admin/experiences/" + lnyId + "/versions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "expectedVersion", initialLockVer,
                                "changeSummary", "AI Golden Dark Luxe update",
                                "config", objectMapper.convertValue(aiDesign.get("proposedConfig"), Map.class)
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.latestVersionNumber").value(2))
                .andReturn();
        long v2LockVer = objectMapper.readTree(v2Res.getResponse().getContentAsString()).get("version").asLong();

        mockMvc.perform(patch("/api/v1/admin/experiences/" + lnyId)
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Stale Update",
                                "expectedVersion", initialLockVer
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        // 6. Activate manually -> public storefront API serves it immediately
        mockMvc.perform(post("/api/v1/admin/experiences/" + lnyId + "/activate")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        mockMvc.perform(get("/api/v1/store/experiences/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.activeExperiences[0].id").value(lnyId))
                .andExpect(jsonPath("$.effectiveThemeOverride.mode").value("dark_luxe"));

        // 7. Rollback to v1 -> live storefront reverts theme override mode back to accent_tint
        mockMvc.perform(post("/api/v1/admin/experiences/" + lnyId + "/rollback/" + v1Id)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestVersionNumber").value(3));

        mockMvc.perform(get("/api/v1/store/experiences/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effectiveThemeOverride.mode").value("accent_tint"));

        // 8. Schedule a Flash Sale in the future (priority 95, STACK) and verify simulator + scheduler lifecycle
        Instant futureStart = Instant.now().plusSeconds(3600);
        Instant futureEnd = Instant.now().plusSeconds(7200);
        MvcResult flashRes = mockMvc.perform(post("/api/v1/admin/experiences")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Scheduled Flash Drop",
                                "presetKey", "flash-sale-surge",
                                "priority", 95,
                                "blendMode", "STACK"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        String flashId = objectMapper.readTree(flashRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/admin/experiences/" + flashId + "/schedule")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "startsAt", futureStart.toString(),
                                "endsAt", futureEnd.toString(),
                                "timezone", "UTC",
                                "recurrenceRule", "NONE"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SCHEDULED"));

        // Simulate during Flash Sale window: both Flash Sale and Lunar New Year are active
        MvcResult simDuring = mockMvc.perform(get("/api/v1/admin/experiences/simulate")
                        .header("Authorization", "Bearer " + editorToken)
                        .param("at", futureStart.plusSeconds(60).toString()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode simJson = objectMapper.readTree(simDuring.getResponse().getContentAsString());
        assertThat(simJson.get("activeExperiences").size()).isEqualTo(2);

        // Scheduler auto-activates at futureStart + 10s, then auto-ends at futureEnd + 10s
        scheduler.processScheduledTransitions(futureStart.plusSeconds(10));
        mockMvc.perform(get("/api/v1/admin/experiences/" + flashId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        scheduler.processScheduledTransitions(futureEnd.plusSeconds(10));
        mockMvc.perform(get("/api/v1/admin/experiences/" + flashId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENDED"));

        // 9. RBAC: VIEWER cannot mutate or update settings; DEMO_OWNER can draft/AI but cannot activate
        mockMvc.perform(put("/api/v1/admin/experiences/settings")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("enabled", false))))
                .andExpect(status().isForbidden());

        MvcResult demoRes = mockMvc.perform(post("/api/v1/auth/demo-owner"))
                .andExpect(status().isCreated())
                .andReturn();
        String demoToken = objectMapper.readTree(demoRes.getResponse().getContentAsString()).get("accessToken").asText();

        MvcResult demoExp = mockMvc.perform(post("/api/v1/admin/experiences")
                        .header("Authorization", "Bearer " + demoToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Demo Winter", "presetKey", "winter-snowfall"))))
                .andExpect(status().isCreated())
                .andReturn();
        String demoExpId = objectMapper.readTree(demoExp.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/admin/experiences/" + demoExpId + "/activate")
                        .header("Authorization", "Bearer " + demoToken))
                .andExpect(status().isForbidden());

        // Cleanup test records on primary store
        mockMvc.perform(post("/api/v1/admin/experiences/" + lnyId + "/deactivate")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/v1/admin/experiences/" + lnyId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/admin/experiences/" + flashId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isNoContent());

        // Confirm storefront is clean again
        mockMvc.perform(get("/api/v1/store/experiences/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeExperiences.length()").value(0));
        assertThat(v2LockVer).isGreaterThan(initialLockVer);
    }

    private String login(String email, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("accessToken").asText();
    }
}
