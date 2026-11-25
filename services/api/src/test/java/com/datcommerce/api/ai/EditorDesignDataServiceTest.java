package com.datcommerce.api.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.datcommerce.api.catalog.CategoryEntity;
import com.datcommerce.api.catalog.CategoryRepository;
import com.datcommerce.api.catalog.CollectionEntity;
import com.datcommerce.api.catalog.CollectionProductRepository;
import com.datcommerce.api.catalog.CollectionRepository;
import com.datcommerce.api.catalog.ProductEntity;
import com.datcommerce.api.catalog.ProductImageRepository;
import com.datcommerce.api.catalog.ProductRepository;
import com.datcommerce.api.catalog.VariantEntity;
import com.datcommerce.api.catalog.VariantRepository;
import com.datcommerce.api.media.MediaAssetEntity;
import com.datcommerce.api.media.MediaAssetRepository;
import com.datcommerce.api.pricing.PriceEntity;
import com.datcommerce.api.pricing.PriceRepository;
import com.datcommerce.api.promotion.PromotionEntity;
import com.datcommerce.api.promotion.PromotionRepository;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EditorDesignDataServiceTest {

    @Test
    void buildsCompactManifestAndExecutesReadOnlyDesignTools() {
        UUID storeId = UUID.randomUUID();
        UUID colId = UUID.randomUUID();
        UUID catId = UUID.randomUUID();
        UUID prodId = UUID.randomUUID();
        UUID varId = UUID.randomUUID();

        StoreRepository storeRepo = mock(StoreRepository.class);
        CollectionRepository colRepo = mock(CollectionRepository.class);
        CollectionProductRepository colProdRepo = mock(CollectionProductRepository.class);
        CategoryRepository catRepo = mock(CategoryRepository.class);
        ProductRepository prodRepo = mock(ProductRepository.class);
        ProductImageRepository imgRepo = mock(ProductImageRepository.class);
        VariantRepository varRepo = mock(VariantRepository.class);
        PriceRepository priceRepo = mock(PriceRepository.class);
        PromotionRepository promoRepo = mock(PromotionRepository.class);
        MediaAssetRepository mediaRepo = mock(MediaAssetRepository.class);

        StoreEntity store = new StoreEntity();
        store.setId(storeId);
        store.setName("Terrain Supply");
        store.setDefaultCurrency("USD");
        when(storeRepo.findById(storeId)).thenReturn(Optional.of(store));

        CategoryEntity cat = new CategoryEntity();
        cat.setId(catId);
        cat.setStoreId(storeId);
        cat.setName("Trail Running");
        cat.setSlug("trail-running");
        cat.setImageUrl("/media/trail.jpg");
        when(catRepo.findAllByStoreIdOrderByNameAsc(storeId)).thenReturn(List.of(cat));

        ProductEntity prod = new ProductEntity();
        prod.setId(prodId);
        prod.setStoreId(storeId);
        prod.setName("Apex Trail Runner");
        prod.setSlug("apex-trail-runner");
        prod.setBrand("Terrain");
        prod.setStatus("ACTIVE");
        prod.setPrimaryImageUrl("/media/apex.jpg");
        prod.setCategories(Set.of(cat));
        when(prodRepo.findAllByStoreIdAndStatusOrderByCreatedAtDesc(storeId, "ACTIVE")).thenReturn(List.of(prod));
        when(prodRepo.findAllByStoreIdOrderByCreatedAtDesc(storeId)).thenReturn(List.of(prod));

        CollectionEntity col = new CollectionEntity();
        col.setId(colId);
        col.setStoreId(storeId);
        col.setName("Autumn Field Kit");
        col.setSlug("autumn-field-kit");
        col.setDescription("Weatherproof essentials for alpine trails.");
        when(colRepo.findAllByStoreIdOrderByNameAsc(storeId)).thenReturn(List.of(col));
        when(colRepo.findByStoreIdAndSlugIgnoreCase(storeId, "autumn-field-kit")).thenReturn(Optional.of(col));

        CollectionEntity.CollectionProductEntity link = new CollectionEntity.CollectionProductEntity();
        link.setId(new CollectionEntity.CollectionProductId(colId, prodId));
        link.setSortOrder(0);
        when(colProdRepo.findAllByIdCollectionIdInOrderBySortOrderAsc(any())).thenReturn(List.of(link));

        VariantEntity variant = new VariantEntity();
        variant.setId(varId);
        variant.setProductId(prodId);
        when(varRepo.findAllByProductIdInOrderByCreatedAtAsc(any())).thenReturn(List.of(variant));

        PriceEntity price = new PriceEntity();
        price.setVariantId(varId);
        price.setCurrency("USD");
        price.setAmount(new BigDecimal("189.00"));
        when(priceRepo.findAllByVariantIdInAndCurrency(any(), eq("USD"))).thenReturn(List.of(price));
        when(imgRepo.findAllByProductIdInOrderBySortOrderAsc(any())).thenReturn(List.of());

        PromotionEntity promo = new PromotionEntity();
        promo.setCode("WELCOME15");
        promo.setName("15% Off First Kit");
        promo.setType("PERCENTAGE");
        promo.setValue(new BigDecimal("15"));
        promo.setScopeType("ORDER");
        promo.setStatus("ACTIVE");
        promo.setEndsAt(Instant.now().plus(14, ChronoUnit.DAYS));
        when(promoRepo.findAllByStoreIdOrderByCreatedAtDesc(storeId)).thenReturn(List.of(promo));

        MediaAssetEntity media = new MediaAssetEntity();
        media.setUrl("/media/hero-autumn.jpg");
        media.setOriginalFilename("hero-autumn.jpg");
        media.setMimeType("image/jpeg");
        media.setAltText("Autumn ridge runner");
        when(mediaRepo.findAllByStoreIdOrderByCreatedAtDesc(storeId)).thenReturn(List.of(media));

        EditorDesignDataService service = new EditorDesignDataService(
                storeRepo, colRepo, colProdRepo, catRepo, prodRepo, imgRepo, varRepo, priceRepo, promoRepo, mediaRepo
        );

        Map<String, Object> manifest = service.buildCompactStoreManifest(storeId);
        assertFalse(manifest.isEmpty());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cols = (List<Map<String, Object>>) manifest.get("collections");
        assertEquals(1, cols.size());
        assertEquals("autumn-field-kit", cols.get(0).get("slug"));
        assertEquals("/media/apex.jpg", cols.get(0).get("coverImage"));

        EditorDesignDataService.DesignToolExecutionResult toolRes = service.executeDesignTool(
                storeId, "design.list_collections", Map.of("includeProducts", true)
        );
        assertEquals("collections", toolRes.dataSource());
        assertEquals(1, toolRes.payload().get("count"));

        EditorDesignDataService.DesignToolExecutionResult searchRes = service.executeDesignTool(
                storeId, "design.search_products", Map.of("collectionSlug", "autumn-field-kit")
        );
        assertEquals("products", searchRes.dataSource());
        assertEquals(1, searchRes.payload().get("count"));

        EditorDesignDataService.DesignToolExecutionResult mediaRes = service.executeDesignTool(
                storeId, "design.list_media_images", Map.of("query", "autumn")
        );
        assertEquals("media", mediaRes.dataSource());
        assertEquals(1, mediaRes.payload().get("count"));

        assertTrue(service.designToolDefinitions().size() == 5);
    }
}
