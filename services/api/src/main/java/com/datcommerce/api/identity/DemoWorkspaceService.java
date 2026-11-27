package com.datcommerce.api.identity;

import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

@Service
public class DemoWorkspaceService {

    public static final Duration DEMO_TTL = Duration.ofHours(2);
    private static final int DEMO_CLONE_PRODUCT_LIMIT = 24;
    private static final int DEMO_CREATE_IP_LIMIT = 15;
    private static final String PRIMARY_STORE_CODE = "terrain-supply";
    private static final Logger log = LoggerFactory.getLogger(DemoWorkspaceService.class);

    private final StoreRepository storeRepository;
    private final AdminUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;
    private final S3Client s3Client;
    private final AppProperties appProperties;
    private final TransactionTemplate transactionTemplate;

    public DemoWorkspaceService(
            StoreRepository storeRepository,
            AdminUserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            AuthService authService,
            JdbcTemplate jdbcTemplate,
            StringRedisTemplate redisTemplate,
            S3Client s3Client,
            AppProperties appProperties,
            PlatformTransactionManager transactionManager
    ) {
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.jdbcTemplate = jdbcTemplate;
        this.redisTemplate = redisTemplate;
        this.s3Client = s3Client;
        this.appProperties = appProperties;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Transactional
    public AuthService.AuthSessionResult startDemoOwnerSession(String userAgent, String ipAddress) {
        String safeIp = StringUtils.hasText(ipAddress) ? ipAddress.trim() : "unknown";
        enforceDemoCreateRateLimit(safeIp);

        StoreEntity primary = storeRepository.findByCode(PRIMARY_STORE_CODE)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Primary store not found"));

        RoleEntity demoRole = roleRepository.findByCode("DEMO_OWNER")
                .orElseThrow(() -> new ApiException(ErrorCode.INTERNAL_ERROR, "DEMO_OWNER role is missing"));

        Instant now = Instant.now();
        Instant expiresAt = now.plus(DEMO_TTL);
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        StoreEntity demoStore = new StoreEntity();
        demoStore.setId(UUID.randomUUID());
        demoStore.setCode("demo-" + shortId);
        demoStore.setName(primary.getName() + " (Demo)");
        demoStore.setDefaultCurrency(primary.getDefaultCurrency());
        demoStore.setLocale(primary.getLocale());
        demoStore.setTimezone(primary.getTimezone());
        demoStore.setContactEmail(primary.getContactEmail());
        demoStore.setPublicDomain(null);
        demoStore.setStatus("ACTIVE");
        demoStore.setDemo(true);
        demoStore.setDemoExpiresAt(expiresAt);
        Map<String, Object> clonedSettings = primary.getSettingsJson() != null
                ? new LinkedHashMap<>(primary.getSettingsJson())
                : new LinkedHashMap<>();
        demoStore.setSettingsJson(clonedSettings);
        demoStore.setCreatedAt(now);
        demoStore.setUpdatedAt(now);
        storeRepository.saveAndFlush(demoStore);

        AdminUserEntity demoUser = new AdminUserEntity();
        demoUser.setId(UUID.randomUUID());
        demoUser.setStoreId(demoStore.getId());
        demoUser.setEmail("demo-" + shortId + "@demo.datcommerce.local");
        demoUser.setFullName("Demo Owner");
        demoUser.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        demoUser.setStatus("ACTIVE");
        demoUser.setRoles(Set.of(demoRole));
        demoUser.setCreatedAt(now);
        demoUser.setUpdatedAt(now);
        userRepository.saveAndFlush(demoUser);

        cloneBaselineData(primary.getId(), demoStore.getId());

        return authService.createSessionForUser(demoUser, userAgent, safeIp, DEMO_TTL.toSeconds());
    }

    @Scheduled(fixedDelayString = "${app.demo.cleanup-interval-ms:300000}")
    public void cleanupExpiredDemoStores() {
        List<StoreEntity> expired = storeRepository.findByDemoTrueAndDemoExpiresAtBefore(Instant.now());
        if (expired.isEmpty()) {
            return;
        }
        log.info("Cleaning up {} expired demo store(s)", expired.size());
        for (StoreEntity store : expired) {
            try {
                transactionTemplate.executeWithoutResult(status -> purgeDemoStore(store.getId()));
            } catch (Exception ex) {
                log.warn("Failed to purge expired demo store {}: {}", store.getId(), ex.getMessage());
            }
        }
    }

    @Transactional
    public void purgeDemoStore(UUID storeId) {
        StoreEntity store = storeRepository.findById(storeId).orElse(null);
        if (store == null) {
            return;
        }
        if (!store.isDemo() || PRIMARY_STORE_CODE.equalsIgnoreCase(store.getCode())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Refusing to purge a non-demo store");
        }

        List<String> storageKeys = jdbcTemplate.queryForList(
                "SELECT storage_key FROM media_assets WHERE store_id = ?",
                String.class,
                storeId
        );
        String bucket = appProperties.getStorage().getBucket();
        for (String key : storageKeys) {
            if (!StringUtils.hasText(key)) continue;
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
            } catch (Exception ignored) {
                // Best-effort S3 cleanup
            }
        }

        jdbcTemplate.update("DELETE FROM order_events WHERE order_id IN (SELECT id FROM orders WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM order_addresses WHERE order_id IN (SELECT id FROM orders WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM orders WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM carts WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM inventory_adjustments WHERE store_id = ?", storeId);
        jdbcTemplate.update(
                "DELETE FROM inventory_reservations WHERE inventory_level_id IN "
                        + "(SELECT il.id FROM inventory_levels il JOIN inventory_items ii ON ii.id = il.inventory_item_id WHERE ii.store_id = ?)",
                storeId
        );
        jdbcTemplate.update("DELETE FROM inventory_levels WHERE inventory_item_id IN (SELECT id FROM inventory_items WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM inventory_items WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM stock_locations WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM prices WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM promotion_targets WHERE promotion_id IN (SELECT id FROM promotions WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM promotions WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM collection_products WHERE collection_id IN (SELECT id FROM collections WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM collections WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM variant_option_values WHERE variant_id IN (SELECT id FROM variants WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM variants WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM product_attribute_values WHERE product_id IN (SELECT id FROM products WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM product_categories WHERE product_id IN (SELECT id FROM products WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM products WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM product_type_attributes WHERE product_type_id IN (SELECT id FROM product_types WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM variant_option_definitions WHERE product_type_id IN (SELECT id FROM product_types WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM attribute_options WHERE attribute_definition_id IN (SELECT id FROM attribute_definitions WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM attribute_definitions WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM product_types WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM categories WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM media_assets WHERE store_id = ?", storeId);
        jdbcTemplate.update(
                "DELETE FROM ai_tool_calls WHERE message_id IN "
                        + "(SELECT m.id FROM ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id WHERE c.store_id = ?)",
                storeId
        );
        jdbcTemplate.update("DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM ai_conversations WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM ai_change_plans WHERE store_id = ?", storeId);
        jdbcTemplate.update(
                "DELETE FROM customer_ai_messages WHERE conversation_id IN (SELECT id FROM customer_ai_conversations WHERE store_id = ?)",
                storeId
        );
        jdbcTemplate.update("DELETE FROM customer_ai_conversations WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM ai_user_daily_token_usage WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM animation_presets WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM seasonal_experience_settings WHERE store_id = ?", storeId);
        jdbcTemplate.update(
                "DELETE FROM seasonal_experience_versions WHERE experience_id IN "
                        + "(SELECT id FROM seasonal_experiences WHERE store_id = ?)",
                storeId
        );
        jdbcTemplate.update("DELETE FROM seasonal_experiences WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM navigation_menus WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM page_versions WHERE page_id IN (SELECT id FROM pages WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM pages WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM theme_configs WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM audit_logs WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM admin_users WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM admin_users WHERE store_id = ?)", storeId);
        jdbcTemplate.update("DELETE FROM admin_users WHERE store_id = ?", storeId);
        jdbcTemplate.update("DELETE FROM stores WHERE id = ? AND is_demo = TRUE", storeId);
    }

    private void cloneBaselineData(UUID srcStoreId, UUID dstStoreId) {
        List<Map<String, Object>> themes = jdbcTemplate.queryForList(
                "SELECT status, tokens_json::text AS tokens_json, note, published_at "
                        + "FROM theme_configs WHERE store_id = ? "
                        + "ORDER BY CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END, version_number DESC LIMIT 1",
                srcStoreId
        );
        for (Map<String, Object> t : themes) {
            jdbcTemplate.update(
                    "INSERT INTO theme_configs (id, store_id, version_number, status, tokens_json, note, published_at, created_at) "
                            + "VALUES (?, ?, 1, ?, CAST(? AS jsonb), ?, ?, NOW())",
                    UUID.randomUUID(), dstStoreId, t.get("status"), t.get("tokens_json"), t.get("note"), t.get("published_at")
            );
        }

        List<Map<String, Object>> pages = jdbcTemplate.queryForList(
                "SELECT id, slug, title, status, seo_title, seo_description, published_version_id FROM pages WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> p : pages) {
            UUID oldPageId = (UUID) p.get("id");
            UUID newPageId = UUID.randomUUID();
            UUID oldPubVerId = (UUID) p.get("published_version_id");

            List<Map<String, Object>> vers = jdbcTemplate.queryForList(
                    "SELECT id, content_json::text AS content_json, change_summary "
                            + "FROM page_versions WHERE page_id = ? ORDER BY version_number DESC LIMIT 3",
                    oldPageId
            );
            jdbcTemplate.update(
                    "INSERT INTO pages (id, store_id, slug, title, status, seo_title, seo_description, published_version_id, latest_version_number, version, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, 0, NOW(), NOW())",
                    newPageId, dstStoreId, p.get("slug"), p.get("title"), p.get("status"),
                    p.get("seo_title"), p.get("seo_description")
            );
            if (!vers.isEmpty()) {
                Map<String, Object> chosen = vers.stream()
                        .filter(v -> oldPubVerId != null && oldPubVerId.equals(v.get("id")))
                        .findFirst()
                        .orElse(vers.get(0));
                UUID verId = UUID.randomUUID();
                jdbcTemplate.update(
                        "INSERT INTO page_versions (id, page_id, version_number, content_json, change_summary, created_at) "
                                + "VALUES (?, ?, 1, CAST(? AS jsonb), ?, NOW())",
                        verId, newPageId, chosen.get("content_json"), chosen.get("change_summary")
                );
                if (oldPubVerId != null) {
                    jdbcTemplate.update("UPDATE pages SET published_version_id = ? WHERE id = ?", verId, newPageId);
                }
            }
        }

        List<Map<String, Object>> menus = jdbcTemplate.queryForList(
                "SELECT menu_key, items_json::text AS items_json FROM navigation_menus WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> m : menus) {
            jdbcTemplate.update(
                    "INSERT INTO navigation_menus (id, store_id, menu_key, items_json, updated_at) "
                            + "VALUES (?, ?, ?, CAST(? AS jsonb), NOW())",
                    UUID.randomUUID(), dstStoreId, m.get("menu_key"), m.get("items_json")
            );
        }

        List<Map<String, Object>> presets = jdbcTemplate.queryForList(
                "SELECT preset_key, name, category, description, config_json::text AS config_json, is_system, is_favorite "
                        + "FROM animation_presets WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> pr : presets) {
            jdbcTemplate.update(
                    "INSERT INTO animation_presets (id, store_id, preset_key, name, category, description, config_json, is_system, is_favorite, version, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, 0, NOW(), NOW())",
                    UUID.randomUUID(), dstStoreId, pr.get("preset_key"), pr.get("name"), pr.get("category"),
                    pr.get("description"), pr.get("config_json"), pr.get("is_system"), pr.get("is_favorite")
            );
        }

        Map<UUID, UUID> expMap = new HashMap<>();
        List<Map<String, Object>> experiences = jdbcTemplate.queryForList(
                "SELECT id, slug, name, description, category, preset_key, status, activation_mode, manual_override, "
                        + "starts_at, ends_at, timezone, recurrence_rule, priority, blend_mode, "
                        + "exclusive_groups_json::text AS exclusive_groups_json, target_pages_json::text AS target_pages_json, "
                        + "max_particle_budget, active_version_id "
                        + "FROM seasonal_experiences WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> exp : experiences) {
            UUID oldExpId = (UUID) exp.get("id");
            UUID newExpId = UUID.randomUUID();
            expMap.put(oldExpId, newExpId);
            UUID oldActiveVerId = (UUID) exp.get("active_version_id");

            List<Map<String, Object>> vers = jdbcTemplate.queryForList(
                    "SELECT id, config_json::text AS config_json, change_summary "
                            + "FROM seasonal_experience_versions WHERE experience_id = ? ORDER BY version_number DESC LIMIT 1",
                    oldExpId
            );
            jdbcTemplate.update(
                    "INSERT INTO seasonal_experiences (id, store_id, slug, name, description, category, preset_key, status, "
                            + "activation_mode, manual_override, starts_at, ends_at, timezone, recurrence_rule, priority, blend_mode, "
                            + "exclusive_groups_json, target_pages_json, max_particle_budget, active_version_id, latest_version_number, version, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?, NULL, 1, 0, NOW(), NOW())",
                    newExpId, dstStoreId, exp.get("slug"), exp.get("name"), exp.get("description"),
                    exp.get("category"), exp.get("preset_key"), exp.get("status"), exp.get("activation_mode"),
                    exp.get("manual_override"), exp.get("starts_at"), exp.get("ends_at"), exp.get("timezone"),
                    exp.get("recurrence_rule"), exp.get("priority"), exp.get("blend_mode"),
                    exp.get("exclusive_groups_json"), exp.get("target_pages_json"), exp.get("max_particle_budget")
            );
            if (!vers.isEmpty()) {
                Map<String, Object> chosen = vers.get(0);
                UUID newVerId = UUID.randomUUID();
                jdbcTemplate.update(
                        "INSERT INTO seasonal_experience_versions (id, experience_id, version_number, config_json, change_summary, created_at) "
                                + "VALUES (?, ?, 1, CAST(? AS jsonb), ?, NOW())",
                        newVerId, newExpId, chosen.get("config_json"), chosen.get("change_summary")
                );
                if (oldActiveVerId != null) {
                    jdbcTemplate.update("UPDATE seasonal_experiences SET active_version_id = ? WHERE id = ?", newVerId, newExpId);
                }
            }
        }

        List<Map<String, Object>> expSettings = jdbcTemplate.queryForList(
                "SELECT enabled, conflict_strategy, max_concurrent_experiences, global_particle_cap, "
                        + "mobile_performance_mode, respect_reduced_motion, fallback_behavior, default_experience_id, allow_customer_dismiss "
                        + "FROM seasonal_experience_settings WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> st : expSettings) {
            UUID newDefaultExpId = expMap.get((UUID) st.get("default_experience_id"));
            jdbcTemplate.update(
                    "INSERT INTO seasonal_experience_settings (store_id, enabled, conflict_strategy, max_concurrent_experiences, "
                            + "global_particle_cap, mobile_performance_mode, respect_reduced_motion, fallback_behavior, default_experience_id, "
                            + "allow_customer_dismiss, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                    dstStoreId, st.get("enabled"), st.get("conflict_strategy"), st.get("max_concurrent_experiences"),
                    st.get("global_particle_cap"), st.get("mobile_performance_mode"), st.get("respect_reduced_motion"),
                    st.get("fallback_behavior"), newDefaultExpId, st.get("allow_customer_dismiss")
            );
        }

        Map<UUID, UUID> locationMap = new HashMap<>();
        List<Map<String, Object>> locs = jdbcTemplate.queryForList(
                "SELECT id, code, name, address, is_default FROM stock_locations WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> l : locs) {
            UUID newLocId = UUID.randomUUID();
            locationMap.put((UUID) l.get("id"), newLocId);
            jdbcTemplate.update(
                    "INSERT INTO stock_locations (id, store_id, code, name, address, is_default, created_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, NOW())",
                    newLocId, dstStoreId, l.get("code"), l.get("name"), l.get("address"), l.get("is_default")
            );
        }

        Map<UUID, UUID> typeMap = new HashMap<>();
        List<Map<String, Object>> types = jdbcTemplate.queryForList(
                "SELECT id, code, name, description FROM product_types WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> t : types) {
            UUID newId = UUID.randomUUID();
            typeMap.put((UUID) t.get("id"), newId);
            jdbcTemplate.update(
                    "INSERT INTO product_types (id, store_id, code, name, description, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
                    newId, dstStoreId, t.get("code"), t.get("name"), t.get("description")
            );
        }

        Map<UUID, UUID> attrMap = new HashMap<>();
        List<Map<String, Object>> attrs = jdbcTemplate.queryForList(
                "SELECT id, code, name, data_type, required, filterable, searchable, unit, validation_rules_json::text AS rules_json "
                        + "FROM attribute_definitions WHERE store_id = ? AND archived_at IS NULL",
                srcStoreId
        );
        for (Map<String, Object> a : attrs) {
            UUID newId = UUID.randomUUID();
            attrMap.put((UUID) a.get("id"), newId);
            jdbcTemplate.update(
                    "INSERT INTO attribute_definitions (id, store_id, code, name, data_type, required, filterable, searchable, unit, validation_rules_json, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), NOW(), NOW())",
                    newId, dstStoreId, a.get("code"), a.get("name"), a.get("data_type"),
                    a.get("required"), a.get("filterable"), a.get("searchable"), a.get("unit"), a.get("rules_json")
            );
            List<Map<String, Object>> opts = jdbcTemplate.queryForList(
                    "SELECT value, label, sort_order FROM attribute_options WHERE attribute_definition_id = ?",
                    a.get("id")
            );
            for (Map<String, Object> o : opts) {
                jdbcTemplate.update(
                        "INSERT INTO attribute_options (id, attribute_definition_id, value, label, sort_order) VALUES (?, ?, ?, ?, ?)",
                        UUID.randomUUID(), newId, o.get("value"), o.get("label"), o.get("sort_order")
                );
            }
        }

        for (Map.Entry<UUID, UUID> te : typeMap.entrySet()) {
            List<Map<String, Object>> ptas = jdbcTemplate.queryForList(
                    "SELECT attribute_definition_id, display_order, required_override FROM product_type_attributes WHERE product_type_id = ?",
                    te.getKey()
            );
            for (Map<String, Object> pta : ptas) {
                UUID newAttrId = attrMap.get((UUID) pta.get("attribute_definition_id"));
                if (newAttrId != null) {
                    jdbcTemplate.update(
                            "INSERT INTO product_type_attributes (product_type_id, attribute_definition_id, display_order, required_override) VALUES (?, ?, ?, ?)",
                            te.getValue(), newAttrId, pta.get("display_order"), pta.get("required_override")
                    );
                }
            }
            List<Map<String, Object>> vods = jdbcTemplate.queryForList(
                    "SELECT code, name, sort_order FROM variant_option_definitions WHERE product_type_id = ?",
                    te.getKey()
            );
            for (Map<String, Object> vod : vods) {
                jdbcTemplate.update(
                        "INSERT INTO variant_option_definitions (id, product_type_id, code, name, sort_order) VALUES (?, ?, ?, ?, ?)",
                        UUID.randomUUID(), te.getValue(), vod.get("code"), vod.get("name"), vod.get("sort_order")
                );
            }
        }

        Map<UUID, UUID> catMap = new HashMap<>();
        List<Map<String, Object>> cats = jdbcTemplate.queryForList(
                "SELECT id, parent_id, slug, name, description, seo_description, image_url, default_product_type_id FROM categories WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> c : cats) {
            UUID newId = UUID.randomUUID();
            catMap.put((UUID) c.get("id"), newId);
            UUID newDefaultTypeId = typeMap.get((UUID) c.get("default_product_type_id"));
            jdbcTemplate.update(
                    "INSERT INTO categories (id, store_id, parent_id, slug, name, description, seo_description, image_url, default_product_type_id, created_at, updated_at) "
                            + "VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
                    newId, dstStoreId, c.get("slug"), c.get("name"), c.get("description"),
                    c.get("seo_description"), c.get("image_url"), newDefaultTypeId
            );
        }
        for (Map<String, Object> c : cats) {
            UUID oldParent = (UUID) c.get("parent_id");
            if (oldParent != null && catMap.containsKey(oldParent)) {
                jdbcTemplate.update(
                        "UPDATE categories SET parent_id = ? WHERE id = ?",
                        catMap.get(oldParent), catMap.get((UUID) c.get("id"))
                );
            }
        }

        Map<UUID, UUID> colMap = new HashMap<>();
        List<Map<String, Object>> cols = jdbcTemplate.queryForList(
                "SELECT id, slug, name, description FROM collections WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> col : cols) {
            UUID newId = UUID.randomUUID();
            colMap.put((UUID) col.get("id"), newId);
            jdbcTemplate.update(
                    "INSERT INTO collections (id, store_id, slug, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
                    newId, dstStoreId, col.get("slug"), col.get("name"), col.get("description")
            );
        }

        Map<UUID, UUID> prodMap = new HashMap<>();
        List<Map<String, Object>> products = jdbcTemplate.queryForList(
                "SELECT id, product_type_id, slug, name, brand, description, status, primary_image_url, seo_title, seo_description, rating, review_count "
                        + "FROM products WHERE store_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT ?",
                srcStoreId, DEMO_CLONE_PRODUCT_LIMIT
        );
        for (Map<String, Object> p : products) {
            UUID oldProdId = (UUID) p.get("id");
            UUID newTypeId = typeMap.get((UUID) p.get("product_type_id"));
            if (newTypeId == null) continue;
            UUID newProdId = UUID.randomUUID();
            prodMap.put(oldProdId, newProdId);

            jdbcTemplate.update(
                    "INSERT INTO products (id, store_id, product_type_id, slug, name, brand, description, status, primary_image_url, seo_title, seo_description, rating, review_count, version, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())",
                    newProdId, dstStoreId, newTypeId, p.get("slug"), p.get("name"), p.get("brand"),
                    p.get("description"), p.get("status"), p.get("primary_image_url"), p.get("seo_title"),
                    p.get("seo_description"), p.get("rating"), p.get("review_count")
            );

            List<UUID> prodCats = jdbcTemplate.queryForList(
                    "SELECT category_id FROM product_categories WHERE product_id = ?",
                    UUID.class, oldProdId
            );
            for (UUID oldCatId : prodCats) {
                UUID newCatId = catMap.get(oldCatId);
                if (newCatId != null) {
                    jdbcTemplate.update("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)", newProdId, newCatId);
                }
            }

            List<Map<String, Object>> imgs = jdbcTemplate.queryForList(
                    "SELECT url, alt_text, sort_order FROM product_images WHERE product_id = ?",
                    oldProdId
            );
            for (Map<String, Object> img : imgs) {
                jdbcTemplate.update(
                        "INSERT INTO product_images (id, product_id, media_asset_id, url, alt_text, sort_order) VALUES (?, ?, NULL, ?, ?, ?)",
                        UUID.randomUUID(), newProdId, img.get("url"), img.get("alt_text"), img.get("sort_order")
                );
            }

            List<Map<String, Object>> pavs = jdbcTemplate.queryForList(
                    "SELECT attribute_definition_id, value_text, value_number, value_boolean, value_date, value_json::text AS value_json "
                            + "FROM product_attribute_values WHERE product_id = ?",
                    oldProdId
            );
            for (Map<String, Object> pav : pavs) {
                UUID newAttrId = attrMap.get((UUID) pav.get("attribute_definition_id"));
                if (newAttrId != null) {
                    jdbcTemplate.update(
                            "INSERT INTO product_attribute_values (id, product_id, attribute_definition_id, value_text, value_number, value_boolean, value_date, value_json) "
                                    + "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb))",
                            UUID.randomUUID(), newProdId, newAttrId,
                            pav.get("value_text"), pav.get("value_number"), pav.get("value_boolean"),
                            pav.get("value_date"), pav.get("value_json")
                    );
                }
            }

            List<Map<String, Object>> vars = jdbcTemplate.queryForList(
                    "SELECT id, sku, title, status FROM variants WHERE product_id = ?",
                    oldProdId
            );
            for (Map<String, Object> v : vars) {
                UUID oldVarId = (UUID) v.get("id");
                UUID newVarId = UUID.randomUUID();
                jdbcTemplate.update(
                        "INSERT INTO variants (id, store_id, product_id, sku, title, status, version, created_at, updated_at) "
                                + "VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())",
                        newVarId, dstStoreId, newProdId, v.get("sku"), v.get("title"), v.get("status")
                );

                List<Map<String, Object>> vovs = jdbcTemplate.queryForList(
                        "SELECT option_name, option_value FROM variant_option_values WHERE variant_id = ?",
                        oldVarId
                );
                for (Map<String, Object> vov : vovs) {
                    jdbcTemplate.update(
                            "INSERT INTO variant_option_values (id, variant_id, option_name, option_value) VALUES (?, ?, ?, ?)",
                            UUID.randomUUID(), newVarId, vov.get("option_name"), vov.get("option_value")
                    );
                }

                List<Map<String, Object>> prices = jdbcTemplate.queryForList(
                        "SELECT currency, amount, compare_at_amount FROM prices WHERE variant_id = ?",
                        oldVarId
                );
                for (Map<String, Object> pr : prices) {
                    jdbcTemplate.update(
                            "INSERT INTO prices (id, store_id, variant_id, currency, amount, compare_at_amount, version, updated_at) "
                                    + "VALUES (?, ?, ?, ?, ?, ?, 0, NOW())",
                            UUID.randomUUID(), dstStoreId, newVarId, pr.get("currency"), pr.get("amount"), pr.get("compare_at_amount")
                    );
                }

                List<Map<String, Object>> invItems = jdbcTemplate.queryForList(
                        "SELECT id, sku FROM inventory_items WHERE variant_id = ?",
                        oldVarId
                );
                for (Map<String, Object> ii : invItems) {
                    UUID oldInvId = (UUID) ii.get("id");
                    UUID newInvId = UUID.randomUUID();
                    jdbcTemplate.update(
                            "INSERT INTO inventory_items (id, store_id, variant_id, sku, created_at) VALUES (?, ?, ?, ?, NOW())",
                            newInvId, dstStoreId, newVarId, ii.get("sku")
                    );
                    List<Map<String, Object>> levels = jdbcTemplate.queryForList(
                            "SELECT stock_location_id, stocked_quantity FROM inventory_levels WHERE inventory_item_id = ?",
                            oldInvId
                    );
                    for (Map<String, Object> lv : levels) {
                        UUID newLocId = locationMap.get((UUID) lv.get("stock_location_id"));
                        if (newLocId != null) {
                            jdbcTemplate.update(
                                    "INSERT INTO inventory_levels (id, inventory_item_id, stock_location_id, stocked_quantity, reserved_quantity, version, updated_at) "
                                            + "VALUES (?, ?, ?, ?, 0, 0, NOW())",
                                    UUID.randomUUID(), newInvId, newLocId, lv.get("stocked_quantity")
                            );
                        }
                    }
                }
            }
        }

        for (Map.Entry<UUID, UUID> ce : colMap.entrySet()) {
            List<Map<String, Object>> cps = jdbcTemplate.queryForList(
                    "SELECT product_id, sort_order FROM collection_products WHERE collection_id = ?",
                    ce.getKey()
            );
            for (Map<String, Object> cp : cps) {
                UUID newProdId = prodMap.get((UUID) cp.get("product_id"));
                if (newProdId != null) {
                    jdbcTemplate.update(
                            "INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)",
                            ce.getValue(), newProdId, cp.get("sort_order")
                    );
                }
            }
        }

        List<Map<String, Object>> promos = jdbcTemplate.queryForList(
                "SELECT code, name, type, value, scope_type, starts_at, ends_at, usage_limit, per_customer_limit, stackable, status "
                        + "FROM promotions WHERE store_id = ?",
                srcStoreId
        );
        for (Map<String, Object> pr : promos) {
            jdbcTemplate.update(
                    "INSERT INTO promotions (id, store_id, code, name, type, value, scope_type, starts_at, ends_at, usage_limit, per_customer_limit, used_count, stackable, status, created_at, updated_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW())",
                    UUID.randomUUID(), dstStoreId, pr.get("code"), pr.get("name"), pr.get("type"), pr.get("value"),
                    pr.get("scope_type"), pr.get("starts_at"), pr.get("ends_at"), pr.get("usage_limit"),
                    pr.get("per_customer_limit"), pr.get("stackable"), pr.get("status")
            );
        }
    }

    private void enforceDemoCreateRateLimit(String ip) {
        String key = "demo:rl:create:" + ip;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, Duration.ofMinutes(15));
            }
            if (count != null && count > DEMO_CREATE_IP_LIMIT) {
                throw new ApiException(ErrorCode.RATE_LIMITED, "Too many demo workspaces created. Please try again shortly.");
            }
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ignored) {
            // Fail-open if Redis is momentarily unavailable
        }
    }
}
