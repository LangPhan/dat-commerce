package com.datcommerce.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
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
class AuthAndRbacIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void unauthenticatedRequestsToAdminEndpointsReturnStructured401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());

        mockMvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void loginRefreshRotationReuseDetectionAndLogoutWork() throws Exception {
        LoginSession session = login("owner@datcommerce.local", "OwnerPass123!");
        assertThat(session.accessToken()).isNotBlank();
        assertThat(session.refreshCookie()).isNotNull();
        assertThat(session.refreshCookie().isHttpOnly()).isTrue();

        mockMvc.perform(get("/api/v1/admin/me")
                        .header("Authorization", "Bearer " + session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("owner@datcommerce.local"))
                .andExpect(jsonPath("$.roles[0]").value("OWNER"));

        // Rotate refresh token
        MvcResult refreshRes = mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(session.refreshCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();
        Cookie rotatedCookie = refreshRes.getResponse().getCookie("dc_refresh_token");
        assertThat(rotatedCookie).isNotNull();
        assertThat(rotatedCookie.getValue()).isNotEqualTo(session.refreshCookie().getValue());

        // Reusing old refresh token fails and revokes rotated token too
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(session.refreshCookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(rotatedCookie))
                .andExpect(status().isUnauthorized());

        // Fresh login then explicit logout revokes session
        LoginSession fresh = login("owner@datcommerce.local", "OwnerPass123!");
        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(fresh.refreshCookie()))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .cookie(fresh.refreshCookie()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void viewerCanReadStoreButIsForbiddenFromMutatingOrReadingAuditLogs() throws Exception {
        LoginSession viewer = login("viewer@datcommerce.local", "ViewerPass123!");

        mockMvc.perform(get("/api/v1/admin/me")
                        .header("Authorization", "Bearer " + viewer.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0]").value("VIEWER"));

        mockMvc.perform(get("/api/v1/admin/store")
                        .header("Authorization", "Bearer " + viewer.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("terrain-supply"));

        mockMvc.perform(post("/api/v1/admin/users")
                        .header("Authorization", "Bearer " + viewer.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "blocked@datcommerce.local",
                                "fullName", "Blocked User",
                                "password", "Password123!",
                                "roles", List.of("VIEWER")
                        ))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(patch("/api/v1/admin/store")
                        .header("Authorization", "Bearer " + viewer.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Hacked"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .header("Authorization", "Bearer " + viewer.accessToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void ownerCanManageUsersAndStoreAndActionsAreRecordedInAuditLogs() throws Exception {
        LoginSession owner = login("owner@datcommerce.local", "OwnerPass123!");
        String uniqueEmail = "staff-" + UUID.randomUUID().toString().substring(0, 8) + "@datcommerce.local";

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/users")
                        .header("Authorization", "Bearer " + owner.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", uniqueEmail,
                                "fullName", "Test Staff",
                                "password", "StrongPass123!",
                                "roles", List.of("CATALOG_MANAGER")
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(uniqueEmail))
                .andExpect(jsonPath("$.roles[0]").value("CATALOG_MANAGER"))
                .andReturn();

        String createdUserId = objectMapper.readTree(createRes.getResponse().getContentAsString())
                .get("id").asText();

        mockMvc.perform(patch("/api/v1/admin/users/" + createdUserId)
                        .header("Authorization", "Bearer " + owner.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Updated Staff",
                                "roles", List.of("ADMIN")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Updated Staff"))
                .andExpect(jsonPath("$.roles[0]").value("ADMIN"));

        mockMvc.perform(patch("/api/v1/admin/store")
                        .header("Authorization", "Bearer " + owner.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Terrain Supply Co."
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Terrain Supply Co."));

        MvcResult auditRes = mockMvc.perform(get("/api/v1/admin/audit-logs?size=50")
                        .header("Authorization", "Bearer " + owner.accessToken()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode auditItems = objectMapper.readTree(auditRes.getResponse().getContentAsString()).get("items");
        List<String> actions = auditItems.findValuesAsText("action");
        assertThat(actions).contains("ADMIN_USER_CREATED", "ADMIN_USER_UPDATED", "STORE_UPDATED");
    }

    private LoginSession login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", password
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        Cookie cookie = result.getResponse().getCookie("dc_refresh_token");
        return new LoginSession(body.get("accessToken").asText(), cookie);
    }

    private record LoginSession(String accessToken, Cookie refreshCookie) {
    }
}
