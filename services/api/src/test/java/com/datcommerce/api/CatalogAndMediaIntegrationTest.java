package com.datcommerce.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.datcommerce.api.common.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CatalogAndMediaIntegrationTest {

    private static final byte[] PNG_1X1 = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    );

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private S3Client s3Client;

    @Autowired
    private AppProperties appProperties;

    @Test
    void productTypeDynamicAttributeValidationArchiveAndTypeSwitchSafety() throws Exception {
        String token = loginOwner();
        String suffix = UUID.randomUUID().toString().substring(0, 6);

        // 1. Create ENUM & NUMBER attributes
        String panelAttrId = createAttribute(token, Map.of(
                "code", "panel_" + suffix,
                "name", "Panel",
                "dataType", "ENUM",
                "required", true,
                "filterable", true,
                "searchable", true,
                "options", List.of(
                        Map.of("value", "IPS", "label", "IPS", "sortOrder", 0),
                        Map.of("value", "OLED", "label", "OLED", "sortOrder", 1)
                )
        ));

        String refreshAttrId = createAttribute(token, Map.of(
                "code", "hz_" + suffix,
                "name", "Refresh Rate",
                "dataType", "NUMBER",
                "required", true,
                "filterable", true,
                "searchable", false,
                "unit", "Hz",
                "validationRules", Map.of("min", 60, "max", 480)
        ));

        // 2. Create Product Type Monitor & a blank fallback Product Type
        String monitorTypeId = createProductType(token, Map.of(
                "code", "monitor-" + suffix,
                "name", "Monitor " + suffix,
                "attributes", List.of(
                        Map.of("attributeDefinitionId", panelAttrId, "displayOrder", 0),
                        Map.of("attributeDefinitionId", refreshAttrId, "displayOrder", 1)
                ),
                "variantOptions", List.of(Map.of("code", "size", "name", "Size", "sortOrder", 0))
        ));

        String otherTypeId = createProductType(token, Map.of(
                "code", "stand-" + suffix,
                "name", "Monitor Stand " + suffix
        ));

        // 3. Reject missing required attribute
        mockMvc.perform(post("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productTypeId", monitorTypeId,
                                "name", "ProView 27",
                                "attributes", Map.of("panel_" + suffix, "OLED"),
                                "variants", List.of(Map.of(
                                        "sku", "PV27-" + suffix,
                                        "title", "27 inch",
                                        "price", 499.00,
                                        "stock", 10
                                ))
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // 4. Reject invalid enum option & out-of-range number
        mockMvc.perform(post("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productTypeId", monitorTypeId,
                                "name", "ProView 27",
                                "attributes", Map.of("panel_" + suffix, "CRT", "hz_" + suffix, 144),
                                "variants", List.of(Map.of(
                                        "sku", "PV27-" + suffix,
                                        "title", "27 inch",
                                        "price", 499.00,
                                        "stock", 10
                                ))
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(post("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productTypeId", monitorTypeId,
                                "name", "ProView 27",
                                "attributes", Map.of("panel_" + suffix, "OLED", "hz_" + suffix, 999),
                                "variants", List.of(Map.of(
                                        "sku", "PV27-" + suffix,
                                        "title", "27 inch",
                                        "price", 499.00,
                                        "stock", 10
                                ))
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // 5. Create valid product
        MvcResult createProd = mockMvc.perform(post("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productTypeId", monitorTypeId,
                                "name", "ProView 27 OLED",
                                "brand", "Forma",
                                "attributes", Map.of("panel_" + suffix, "OLED", "hz_" + suffix, 240),
                                "variants", List.of(Map.of(
                                        "sku", "PV27-" + suffix,
                                        "title", "27 inch",
                                        "price", 599.00,
                                        "stock", 8
                                ))
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attributes.length()").value(2))
                .andReturn();

        String productId = objectMapper.readTree(createProd.getResponse().getContentAsString())
                .get("id").asText();

        // 6. Deleting an attribute already used archives instead of hard deleting
        mockMvc.perform(delete("/api/v1/admin/attributes/" + panelAttrId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true))
                .andExpect(jsonPath("$.archivedAt").isNotEmpty());

        // 7. Switching productType without confirmation fails 409 CONFLICT
        mockMvc.perform(patch("/api/v1/admin/products/" + productId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "productTypeId", otherTypeId
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void storefrontFilteringByCategoryAndDynamicAttributeWorks() throws Exception {
        MvcResult res = mockMvc.perform(get("/api/v1/store/products")
                        .param("category", "running-shoes")
                        .param("attr.gender", "Men"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Nike Wildhorse 8"))
                .andExpect(jsonPath("$.facets").isArray())
                .andReturn();

        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(root.get("facets").size()).isGreaterThan(0);
    }

    @Test
    void mediaUploadStoresObjectInSiloAndDeleteRemovesIt() throws Exception {
        String token = loginOwner();
        MockMultipartFile file = new MockMultipartFile(
                "file", "sample-gear.png", "image/png", PNG_1X1
        );

        MvcResult uploadRes = mockMvc.perform(multipart("/api/v1/admin/media")
                        .file(file)
                        .param("altText", "Sample Gear")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url").isNotEmpty())
                .andReturn();

        JsonNode asset = objectMapper.readTree(uploadRes.getResponse().getContentAsString());
        String mediaId = asset.get("id").asText();
        String storageKey = asset.get("storageKey").asText();

        var head = s3Client.headObject(HeadObjectRequest.builder()
                .bucket(appProperties.getStorage().getBucket())
                .key(storageKey)
                .build());
        assertThat(head.contentLength()).isEqualTo(PNG_1X1.length);

        mockMvc.perform(delete("/api/v1/admin/media/" + mediaId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    private String loginOwner() throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "owner@datcommerce.local",
                                "password", "OwnerPass123!"
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String createAttribute(String token, Map<String, Object> body) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/admin/attributes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
    }

    private String createProductType(String token, Map<String, Object> body) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/admin/product-types")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
    }
}
