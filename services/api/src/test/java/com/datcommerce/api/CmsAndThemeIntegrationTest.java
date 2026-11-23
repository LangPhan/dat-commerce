package com.datcommerce.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
class CmsAndThemeIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void cmsDraftPublishLockingRollbackAndValidationEnforced() throws Exception {
        String editorToken = login("editor@datcommerce.local", "EditorPass123!");
        String viewerToken = login("viewer@datcommerce.local", "ViewerPass123!");

        // 1. Public store reads work without auth
        MvcResult pubPageRes = mockMvc.perform(get("/api/v1/store/pages/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("home"))
                .andExpect(jsonPath("$.content.blocks").isArray())
                .andReturn();
        String homePageId = objectMapper.readTree(pubPageRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/api/v1/store/theme"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.tokens.colors.primary").exists());

        mockMvc.perform(get("/api/v1/store/navigation/main"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());

        // 2. Reject invalid block types and XSS scripts / unsafe URLs
        mockMvc.perform(post("/api/v1/admin/pages/" + homePageId + "/versions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "content", Map.of("blocks", List.of(Map.of(
                                        "id", "bad1",
                                        "type", "arbitrary_html",
                                        "label", "Bad",
                                        "visible", true,
                                        "props", Map.of()
                                )))
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(post("/api/v1/admin/pages/" + homePageId + "/versions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "content", Map.of("blocks", List.of(Map.of(
                                        "id", "xss1",
                                        "type", "hero",
                                        "label", "XSS",
                                        "visible", true,
                                        "props", Map.of("heading", "<script>alert(1)</script>", "actionUrl", "javascript:alert(1)")
                                )))
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // 3. Reject invalid theme tokens
        mockMvc.perform(post("/api/v1/admin/theme/versions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "tokens", Map.of(
                                        "colors", Map.of("primary", "not-hex", "background", "#FFFFFF", "text", "#111318"),
                                        "typography", Map.of("headingFont", "Comic Sans")
                                )
                        ))))
                .andExpect(status().isBadRequest());

        // 4. Draft isolation + optimistic locking + publish + rollback
        MvcResult adminPageRes = mockMvc.perform(get("/api/v1/admin/pages/" + homePageId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode adminPage = objectMapper.readTree(adminPageRes.getResponse().getContentAsString());
        long version = adminPage.get("version").asLong();
        String v1Id = adminPage.get("versions").get(adminPage.get("versions").size() - 1).get("id").asText();

        MvcResult saveDraftRes = mockMvc.perform(post("/api/v1/admin/pages/" + homePageId + "/versions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "expectedVersion", version,
                                "changeSummary", "Draft hero update",
                                "content", Map.of("blocks", List.of(Map.of(
                                        "id", "hero",
                                        "type", "hero",
                                        "label", "Hero banner",
                                        "visible", true,
                                        "props", Map.of(
                                                "heading", "Draft Only Headline",
                                                "copy", "Tested safely in draft",
                                                "action", "Shop",
                                                "actionUrl", "/store/shop",
                                                "image", "/media/terrain-hero.jpg",
                                                "tone", "ink",
                                                "layout", "split",
                                                "scale", "large"
                                        )
                                )))
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode savedDraft = objectMapper.readTree(saveDraftRes.getResponse().getContentAsString());
        long nextVersion = savedDraft.get("version").asLong();

        // Storefront still serves original published headline before publish
        MvcResult stillPublished = mockMvc.perform(get("/api/v1/store/pages/home"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(stillPublished.getResponse().getContentAsString()).doesNotContain("Draft Only Headline");

        // Stale version fails with 409 CONFLICT
        mockMvc.perform(post("/api/v1/admin/pages/" + homePageId + "/versions")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "expectedVersion", version,
                                "content", Map.of("blocks", List.of())
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        // Publish makes draft visible on storefront
        mockMvc.perform(post("/api/v1/admin/pages/" + homePageId + "/publish")
                        .header("Authorization", "Bearer " + editorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("expectedVersion", nextVersion))))
                .andExpect(status().isOk());

        MvcResult afterPublish = mockMvc.perform(get("/api/v1/store/pages/home"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(afterPublish.getResponse().getContentAsString()).contains("Draft Only Headline");

        // Rollback restores original v1 cleanly
        mockMvc.perform(post("/api/v1/admin/pages/" + homePageId + "/rollback/" + v1Id)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isOk());

        MvcResult afterRollback = mockMvc.perform(get("/api/v1/store/pages/home"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(afterRollback.getResponse().getContentAsString()).doesNotContain("Draft Only Headline");

        // VIEWER cannot write CMS drafts or themes
        mockMvc.perform(post("/api/v1/admin/theme/versions")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "tokens", Map.of("colors", Map.of("primary", "#112233", "background", "#FFFFFF", "text", "#111318"))
                        ))))
                .andExpect(status().isForbidden());
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
