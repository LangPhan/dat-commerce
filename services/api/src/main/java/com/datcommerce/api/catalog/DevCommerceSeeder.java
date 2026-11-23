package com.datcommerce.api.catalog;

import com.datcommerce.api.inventory.InventoryService;
import com.datcommerce.api.order.OrderAddressEntity;
import com.datcommerce.api.order.OrderAddressRepository;
import com.datcommerce.api.order.OrderEntity;
import com.datcommerce.api.order.OrderEventEntity;
import com.datcommerce.api.order.OrderEventRepository;
import com.datcommerce.api.order.OrderItemEntity;
import com.datcommerce.api.order.OrderItemRepository;
import com.datcommerce.api.order.OrderRepository;
import com.datcommerce.api.payment.PaymentEntity;
import com.datcommerce.api.payment.PaymentRepository;
import com.datcommerce.api.pricing.PricingService;
import com.datcommerce.api.promotion.PromotionEntity;
import com.datcommerce.api.promotion.PromotionRepository;
import com.datcommerce.api.promotion.PromotionTargetEntity;
import com.datcommerce.api.promotion.PromotionTargetRepository;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(2)
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DevCommerceSeeder implements ApplicationRunner {

    private final StoreRepository storeRepository;
    private final ProductTypeRepository productTypeRepository;
    private final AttributeDefinitionRepository attributeRepository;
    private final AttributeOptionRepository attributeOptionRepository;
    private final ProductTypeAttributeRepository typeAttributeRepository;
    private final VariantOptionDefinitionRepository variantOptionDefRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final VariantRepository variantRepository;
    private final VariantOptionValueRepository variantOptionValueRepository;
    private final CollectionRepository collectionRepository;
    private final CollectionProductRepository collectionProductRepository;
    private final AttributeValidationService attributeValidationService;
    private final PricingService pricingService;
    private final InventoryService inventoryService;
    private final PromotionRepository promotionRepository;
    private final PromotionTargetRepository promotionTargetRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderAddressRepository orderAddressRepository;
    private final OrderEventRepository orderEventRepository;
    private final PaymentRepository paymentRepository;

    public DevCommerceSeeder(
            StoreRepository storeRepository,
            ProductTypeRepository productTypeRepository,
            AttributeDefinitionRepository attributeRepository,
            AttributeOptionRepository attributeOptionRepository,
            ProductTypeAttributeRepository typeAttributeRepository,
            VariantOptionDefinitionRepository variantOptionDefRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            ProductImageRepository productImageRepository,
            VariantRepository variantRepository,
            VariantOptionValueRepository variantOptionValueRepository,
            CollectionRepository collectionRepository,
            CollectionProductRepository collectionProductRepository,
            AttributeValidationService attributeValidationService,
            PricingService pricingService,
            InventoryService inventoryService,
            PromotionRepository promotionRepository,
            PromotionTargetRepository promotionTargetRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderAddressRepository orderAddressRepository,
            OrderEventRepository orderEventRepository,
            PaymentRepository paymentRepository
    ) {
        this.storeRepository = storeRepository;
        this.productTypeRepository = productTypeRepository;
        this.attributeRepository = attributeRepository;
        this.attributeOptionRepository = attributeOptionRepository;
        this.typeAttributeRepository = typeAttributeRepository;
        this.variantOptionDefRepository = variantOptionDefRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
        this.variantRepository = variantRepository;
        this.variantOptionValueRepository = variantOptionValueRepository;
        this.collectionRepository = collectionRepository;
        this.collectionProductRepository = collectionProductRepository;
        this.attributeValidationService = attributeValidationService;
        this.pricingService = pricingService;
        this.inventoryService = inventoryService;
        this.promotionRepository = promotionRepository;
        this.promotionTargetRepository = promotionTargetRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.orderAddressRepository = orderAddressRepository;
        this.orderEventRepository = orderEventRepository;
        this.paymentRepository = paymentRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        StoreEntity store = storeRepository.findByCode("terrain-supply")
                .orElseThrow(() -> new IllegalStateException("Default store missing"));
        UUID storeId = store.getId();

        if (!productTypeRepository.findAllByStoreIdOrderByNameAsc(storeId).isEmpty()) {
            return;
        }

        inventoryService.ensureDefaultLocation(storeId);
        Instant now = Instant.now();

        // 1. Attribute Definitions
        var attrMaterial = createAttr(storeId, "material", "Material", "TEXT", false, true, true, null, Map.of(), List.of(), now);
        var attrGender = createAttr(storeId, "gender", "Gender", "ENUM", false, true, true, null, Map.of(), List.of("Men", "Women", "Unisex"), now);
        var attrWaterproof = createAttr(storeId, "waterproof", "Waterproof", "BOOLEAN", false, true, false, null, Map.of(), List.of(), now);
        var attrSoleHeight = createAttr(storeId, "sole_height", "Sole Height", "NUMBER", false, false, false, "mm", Map.of("min", 10, "max", 60), List.of(), now);
        var attrCpu = createAttr(storeId, "cpu", "CPU", "TEXT", true, true, true, null, Map.of(), List.of(), now);
        var attrRam = createAttr(storeId, "ram_gb", "RAM", "NUMBER", true, true, true, "GB", Map.of("min", 4, "max", 256), List.of(), now);
        var attrStorage = createAttr(storeId, "storage_gb", "Storage", "NUMBER", true, true, true, "GB", Map.of("min", 64, "max", 8192), List.of(), now);
        var attrScreen = createAttr(storeId, "screen_inches", "Screen Size", "NUMBER", true, true, true, "inch", Map.of("min", 10, "max", 20), List.of(), now);
        var attr5g = createAttr(storeId, "five_g_ready", "5G Ready", "BOOLEAN", false, true, false, null, Map.of(), List.of(), now);
        var attrCapacity = createAttr(storeId, "capacity_l", "Capacity", "NUMBER", false, true, false, "L", Map.of("min", 1, "max", 120), List.of(), now);
        var attrBattery = createAttr(storeId, "battery_days", "Battery Life", "NUMBER", false, true, false, "days", Map.of("min", 1, "max", 90), List.of(), now);

        // 2. Product Types
        var typeShoes = createType(storeId, "shoes", "Shoes", "Trail and road footwear",
                List.of(attrMaterial, attrGender, attrWaterproof, attrSoleHeight),
                List.of(new String[]{"size", "Size"}, new String[]{"color", "Color"}), now);
        var typeLaptop = createType(storeId, "laptop", "Laptop", "Mobile workstations and ultrabooks",
                List.of(attrCpu, attrRam, attrStorage, attrScreen),
                List.of(new String[]{"ram_config", "RAM"}, new String[]{"storage_config", "Storage"}), now);
        var typePhone = createType(storeId, "phone", "Phone", "Flagship unlocked smartphones",
                List.of(attrRam, attrStorage, attr5g),
                List.of(new String[]{"storage_config", "Storage"}, new String[]{"color", "Color"}), now);
        var typeApparel = createType(storeId, "apparel", "Apparel", "Technical outerwear and base layers",
                List.of(attrMaterial, attrWaterproof, attrGender),
                List.of(new String[]{"size", "Size"}, new String[]{"color", "Color"}), now);
        var typeAccessories = createType(storeId, "accessories", "Accessories", "Packs and modular carry systems",
                List.of(attrMaterial, attrCapacity),
                List.<String[]>of(new String[]{"color", "Color"}), now);
        var typeElectronics = createType(storeId, "electronics", "Electronics", "GPS watches and field electronics",
                List.of(attrBattery, attrWaterproof),
                List.<String[]>of(new String[]{"color", "Color"}), now);

        // 3. Categories
        var catFootwear = createCategory(storeId, null, "footwear", "Footwear",
                "Trail-tested shoes engineered for technical terrain and long-distance comfort.",
                "/media/shoe-olive.jpg", typeShoes.getId(), now);
        var catRunningShoes = createCategory(storeId, catFootwear.getId(), "running-shoes", "Running Shoes",
                "Responsive trail and road running footwear with Vibram-grade traction.",
                "/media/shoe-red.jpg", typeShoes.getId(), now);
        var catTrailRunning = createCategory(storeId, catFootwear.getId(), "trail-running", "Trail Running",
                "Lightweight, high-grip running shoes built for steep ascents and fast descents.",
                "/media/shoe-white.jpg", typeShoes.getId(), now);
        var catLaptops = createCategory(storeId, null, "laptops", "Laptops",
                "Precision-milled mobile workstations for creative studios and field engineering.",
                "/media/laptop-pro.svg", typeLaptop.getId(), now);
        var catPhones = createCategory(storeId, null, "phones", "Phones",
                "Flagship smartphones with titanium frames, pro optics, and satellite-ready connectivity.",
                "/media/phone-pro.svg", typePhone.getId(), now);
        var catApparel = createCategory(storeId, null, "apparel", "Apparel",
                "Breathable storm shells and merino base layers designed for shifting elevations.",
                "/media/jacket.jpg", typeApparel.getId(), now);
        var catAccessories = createCategory(storeId, null, "accessories", "Accessories",
                "Modular packs, carry systems, and daily essentials for organized travel.",
                "/media/pack.jpg", typeAccessories.getId(), now);
        var catElectronics = createCategory(storeId, null, "electronics", "Electronics",
                "Multi-band GPS watches and rugged field instruments built to outlast the grid.",
                "/media/watch.jpg", typeElectronics.getId(), now);

        // 4. Products + Variants
        var pRidge = createProduct(storeId, typeShoes.getId(), "ridge-runner-gtx", "Ridge Runner GTX", "Terrain",
                "Waterproof Gore-Tex trail shoe with Vibram Megagrip lugs built for wet alpine ridges.",
                "/media/shoe-olive.jpg", List.of(catFootwear, catTrailRunning),
                Map.of("material", "Ripstop & Gore-Tex", "gender", "Unisex", "waterproof", true, "sole_height", 32),
                List.of(
                        new SeedVariant("RR-GTX-OLV-09", "US 9 · Olive", "168.00", "195.00", 14, Map.of("size", "9", "color", "Olive")),
                        new SeedVariant("RR-GTX-OLV-10", "US 10 · Olive", "168.00", "195.00", 18, Map.of("size", "10", "color", "Olive")),
                        new SeedVariant("RR-GTX-OLV-11", "US 11 · Olive", "168.00", "195.00", 9, Map.of("size", "11", "color", "Olive"))
                ), now);

        var pNikePeg = createProduct(storeId, typeShoes.getId(), "nike-pegasus-trail-5", "Nike Pegasus Trail 5", "Nike",
                "ReactX foam cushioning paired with an all-terrain ATC outsole for smooth road-to-trail transitions.",
                "/media/shoe-red.jpg", List.of(catFootwear, catRunningShoes, catTrailRunning),
                Map.of("material", "Engineered Mesh", "gender", "Unisex", "waterproof", false, "sole_height", 34),
                List.of(
                        new SeedVariant("NK-PEG5-RED-09", "US 9 · Crimson", "150.00", null, 20, Map.of("size", "9", "color", "Crimson")),
                        new SeedVariant("NK-PEG5-RED-10", "US 10 · Crimson", "150.00", null, 22, Map.of("size", "10", "color", "Crimson"))
                ), now);

        var pNikeWild = createProduct(storeId, typeShoes.getId(), "nike-wildhorse-8", "Nike Wildhorse 8", "Nike",
                "Rugged trail running workhorse with midfoot saddle lockdown and rock plate protection.",
                "/media/shoe-white.jpg", List.of(catFootwear, catRunningShoes),
                Map.of("material", "Ballistic Mesh", "gender", "Men", "waterproof", false, "sole_height", 36),
                List.of(
                        new SeedVariant("NK-WH8-CHK-10", "US 10 · Chalk", "140.00", null, 15, Map.of("size", "10", "color", "Chalk")),
                        new SeedVariant("NK-WH8-CHK-11", "US 11 · Chalk", "140.00", null, 12, Map.of("size", "11", "color", "Chalk"))
                ), now);

        var pFormaPro = createProduct(storeId, typeLaptop.getId(), "formabook-pro-14", "FormaBook Pro 14", "Forma",
                "CNC-anodized 14-inch workstation with 120Hz Mini-LED display, M4 Pro silicon, and 18-hour battery.",
                "/media/laptop-pro.svg", List.of(catLaptops),
                Map.of("cpu", "Forma M4 Pro 12-Core", "ram_gb", 32, "storage_gb", 1024, "screen_inches", 14.2),
                List.of(
                        new SeedVariant("FBP14-32-1T", "32GB / 1TB", "1899.00", "2099.00", 12, Map.of("ram_config", "32GB", "storage_config", "1TB")),
                        new SeedVariant("FBP14-64-2T", "64GB / 2TB", "2399.00", null, 6, Map.of("ram_config", "64GB", "storage_config", "2TB"))
                ), now);

        var pFormaAir = createProduct(storeId, typeLaptop.getId(), "formabook-air-15", "FormaBook Air 15", "Forma",
                "Fanless 15-inch field notebook weighing 1.38 kg with dual Thunderbolt ports and all-day endurance.",
                "/media/laptop-air.svg", List.of(catLaptops),
                Map.of("cpu", "Forma M4 8-Core", "ram_gb", 16, "storage_gb", 512, "screen_inches", 15.3),
                List.of(
                        new SeedVariant("FBA15-16-512", "16GB / 512GB", "1299.00", null, 19, Map.of("ram_config", "16GB", "storage_config", "512GB"))
                ), now);

        var pThinkSlate = createProduct(storeId, typeLaptop.getId(), "thinkslate-ultra-16", "ThinkSlate Ultra 16", "Kova",
                "Color-calibrated 16-inch studio laptop engineered for 3D rendering, compiling, and raw video.",
                "/media/laptop-pro.svg", List.of(catLaptops),
                Map.of("cpu", "Intel Core Ultra 9", "ram_gb", 32, "storage_gb", 1024, "screen_inches", 16.0),
                List.of(
                        new SeedVariant("KVA16-32-1T", "32GB / 1TB", "1749.00", null, 10, Map.of("ram_config", "32GB", "storage_config", "1TB"))
                ), now);

        var pPixelis = createProduct(storeId, typePhone.getId(), "pixelis-16-pro", "Pixelis 16 Pro", "Nova",
                "Grade-5 titanium flagship phone with 48MP periscope optics, LTPO OLED, and satellite SOS.",
                "/media/phone-pro.svg", List.of(catPhones),
                Map.of("ram_gb", 12, "storage_gb", 256, "five_g_ready", true),
                List.of(
                        new SeedVariant("PX16P-256", "256GB · Titanium", "999.00", null, 24, Map.of("storage_config", "256GB", "color", "Titanium")),
                        new SeedVariant("PX16P-512", "512GB · Obsidian", "1149.00", null, 14, Map.of("storage_config", "512GB", "color", "Obsidian"))
                ), now);

        var pNovaAir = createProduct(storeId, typePhone.getId(), "nova-phone-air", "Nova Phone Air", "Nova",
                "Ultralight unlocked 5G smartphone with clean OS, ceramic shield glass, and 45W fast charge.",
                "/media/phone-air.svg", List.of(catPhones),
                Map.of("ram_gb", 8, "storage_gb", 128, "five_g_ready", true),
                List.of(
                        new SeedVariant("NPA-128-SLV", "128GB · Silver", "649.00", null, 28, Map.of("storage_config", "128GB", "color", "Silver"))
                ), now);

        var pJacket = createProduct(storeId, typeApparel.getId(), "summit-shell-jacket", "Summit Shell Jacket", "Terrain",
                "3-layer seam-taped storm shell with pit zips and helmet-compatible hood for alpine squalls.",
                "/media/jacket.jpg", List.of(catApparel),
                Map.of("material", "3L Gore-Tex Pro", "waterproof", true, "gender", "Unisex"),
                List.of(
                        new SeedVariant("SSJ-M-FOR", "M · Forest", "285.00", "320.00", 16, Map.of("size", "M", "color", "Forest")),
                        new SeedVariant("SSJ-L-FOR", "L · Forest", "285.00", "320.00", 11, Map.of("size", "L", "color", "Forest"))
                ), now);

        var pMerino = createProduct(storeId, typeApparel.getId(), "merino-200-base-crew", "Merino 200 Base Crew", "Terrain",
                "200gsm superfine merino wool base layer regulating core warmth across changing elevation.",
                "/media/jacket.jpg", List.of(catApparel),
                Map.of("material", "100% Merino Wool", "waterproof", false, "gender", "Unisex"),
                List.of(
                        new SeedVariant("MBC-M-SLT", "M · Slate", "98.00", null, 25, Map.of("size", "M", "color", "Slate"))
                ), now);

        var pPack = createProduct(storeId, typeAccessories.getId(), "traverse-daypack-22l", "Traverse Daypack 22L", "Terrain",
                "Weatherproof Cordura pack with suspended 16-inch laptop sleeve and quick-access camera pocket.",
                "/media/pack.jpg", List.of(catAccessories),
                Map.of("material", "420D Ripstop Nylon", "capacity_l", 22),
                List.of(
                        new SeedVariant("TDP-22-BLK", "22L · Charcoal", "145.00", null, 4, Map.of("color", "Charcoal"))
                ), now);

        var pWatch = createProduct(storeId, typeElectronics.getId(), "field-gps-watch", "Field GPS Watch", "Terrain",
                "Dual-frequency GPS expedition watch with sapphire crystal, topo maps, and 30-day battery.",
                "/media/watch.jpg", List.of(catElectronics),
                Map.of("battery_days", 30, "waterproof", true),
                List.of(
                        new SeedVariant("FGW-TIT-01", "Titanium Bezel", "399.00", "449.00", 3, Map.of("color", "Titanium"))
                ), now);

        // 5. Collections
        createCollection(storeId, "the-alpine-collection", "The Alpine Collection",
                "High-elevation footwear, storm shells, and navigation instruments.",
                List.of(pRidge.getId(), pJacket.getId(), pPack.getId(), pWatch.getId()), now);
        createCollection(storeId, "studio-hardware", "Studio Hardware",
                "Precision-milled laptops and titanium mobile hardware for creators.",
                List.of(pFormaPro.getId(), pFormaAir.getId(), pThinkSlate.getId(), pPixelis.getId()), now);

        // 6. Promotions
        createPromo(storeId, "TRAIL10", "Autumn Trail Welcome", "PERCENTAGE", new BigDecimal("10.00"), "ALL",
                now.minus(5, ChronoUnit.DAYS), now.plus(30, ChronoUnit.DAYS), 200, "ACTIVE", List.of(), now);
        createPromo(storeId, "HIKE20", "Weekend Footwear Drop", "FIXED_AMOUNT", new BigDecimal("20.00"), "CATEGORY",
                now.minus(2, ChronoUnit.DAYS), now.plus(14, ChronoUnit.DAYS), 100, "ACTIVE", List.of(catFootwear.getId()), now);
        createPromo(storeId, "TECH15", "Studio Hardware Launch", "PERCENTAGE", new BigDecimal("15.00"), "CATEGORY",
                now.minus(1, ChronoUnit.DAYS), now.plus(21, ChronoUnit.DAYS), 75, "DRAFT", List.of(catLaptops.getId()), now);

        // 7. Sample Orders (so Admin Orders & Dashboard Analytics reflect live PostgreSQL data)
        seedOrder(storeId, "TR-1052", "Clara Sterling", "clara.sterling@example.com",
                "CONFIRMED", "PAID", "UNFULFILLED", "1899.00", "0.00", "0.00", "1899.00",
                null, pFormaPro, "FBP14-32-1T", "32GB / 1TB", new BigDecimal("1899.00"), 1,
                "742 Evergreen Terrace", "Seattle", "WA", "98101", now.minus(4, ChronoUnit.HOURS));
        seedOrder(storeId, "TR-1051", "Marcus Chen", "marcus.chen@example.com",
                "PROCESSING", "PAID", "PROCESSING", "1167.00", "116.70", "0.00", "1050.30",
                "TRAIL10", pPixelis, "PX16P-256", "256GB · Titanium", new BigDecimal("999.00"), 1,
                "418 Valencia St", "San Francisco", "CA", "94103", now.minus(1, ChronoUnit.DAYS));
        seedOrder(storeId, "TR-1048", "Morgan Taylor", "morgan@example.com",
                "DELIVERED", "PAID", "DELIVERED", "168.00", "0.00", "0.00", "168.00",
                null, pRidge, "RR-GTX-OLV-09", "US 9 · Olive", new BigDecimal("168.00"), 1,
                "120 NW Flanders St", "Portland", "OR", "97209", now.minus(2, ChronoUnit.DAYS));
    }

    private AttributeDefinitionEntity createAttr(
            UUID storeId, String code, String name, String dataType,
            boolean required, boolean filterable, boolean searchable,
            String unit, Map<String, Object> rules, List<String> enumOpts, Instant now
    ) {
        AttributeDefinitionEntity def = new AttributeDefinitionEntity();
        def.setId(UUID.randomUUID());
        def.setStoreId(storeId);
        def.setCode(code);
        def.setName(name);
        def.setDataType(dataType);
        def.setRequired(required);
        def.setFilterable(filterable);
        def.setSearchable(searchable);
        def.setUnit(unit);
        def.setValidationRulesJson(rules);
        def.setCreatedAt(now);
        def.setUpdatedAt(now);
        AttributeDefinitionEntity saved = attributeRepository.save(def);

        for (int i = 0; i < enumOpts.size(); i++) {
            AttributeOptionEntity opt = new AttributeOptionEntity();
            opt.setId(UUID.randomUUID());
            opt.setAttributeDefinitionId(saved.getId());
            opt.setValue(enumOpts.get(i));
            opt.setLabel(enumOpts.get(i));
            opt.setSortOrder(i);
            attributeOptionRepository.save(opt);
        }
        return saved;
    }

    private ProductTypeEntity createType(
            UUID storeId, String code, String name, String description,
            List<AttributeDefinitionEntity> attrs, List<String[]> varOpts, Instant now
    ) {
        ProductTypeEntity type = new ProductTypeEntity();
        type.setId(UUID.randomUUID());
        type.setStoreId(storeId);
        type.setCode(code);
        type.setName(name);
        type.setDescription(description);
        type.setCreatedAt(now);
        type.setUpdatedAt(now);
        ProductTypeEntity saved = productTypeRepository.save(type);

        for (int i = 0; i < attrs.size(); i++) {
            ProductTypeAttributeEntity b = new ProductTypeAttributeEntity();
            b.setId(new ProductTypeAttributeEntity.ProductTypeAttributeId(saved.getId(), attrs.get(i).getId()));
            b.setDisplayOrder(i);
            typeAttributeRepository.save(b);
        }
        for (int i = 0; i < varOpts.size(); i++) {
            VariantOptionDefinitionEntity vo = new VariantOptionDefinitionEntity();
            vo.setId(UUID.randomUUID());
            vo.setProductTypeId(saved.getId());
            vo.setCode(varOpts.get(i)[0]);
            vo.setName(varOpts.get(i)[1]);
            vo.setSortOrder(i);
            variantOptionDefRepository.save(vo);
        }
        return saved;
    }

    private CategoryEntity createCategory(
            UUID storeId, UUID parentId, String slug, String name, String description,
            String imageUrl, UUID defaultTypeId, Instant now
    ) {
        CategoryEntity cat = new CategoryEntity();
        cat.setId(UUID.randomUUID());
        cat.setStoreId(storeId);
        cat.setParentId(parentId);
        cat.setSlug(slug);
        cat.setName(name);
        cat.setDescription(description);
        cat.setSeoDescription(description);
        cat.setImageUrl(imageUrl);
        cat.setDefaultProductTypeId(defaultTypeId);
        cat.setCreatedAt(now);
        cat.setUpdatedAt(now);
        return categoryRepository.save(cat);
    }

    private ProductEntity createProduct(
            UUID storeId, UUID productTypeId, String slug, String name, String brand,
            String description, String imageUrl, List<CategoryEntity> cats,
            Map<String, Object> attrs, List<SeedVariant> variants, Instant now
    ) {
        ProductEntity p = new ProductEntity();
        p.setId(UUID.randomUUID());
        p.setStoreId(storeId);
        p.setProductTypeId(productTypeId);
        p.setSlug(slug);
        p.setName(name);
        p.setBrand(brand);
        p.setDescription(description);
        p.setStatus("ACTIVE");
        p.setPrimaryImageUrl(imageUrl);
        p.setSeoTitle(name + " · Terrain Supply");
        p.setSeoDescription(description);
        p.setRating(new BigDecimal("4.85"));
        p.setReviewCount(18);
        p.setCategories(Set.copyOf(cats));
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        ProductEntity saved = productRepository.saveAndFlush(p);

        ProductImageEntity img = new ProductImageEntity();
        img.setId(UUID.randomUUID());
        img.setProductId(saved.getId());
        img.setUrl(imageUrl);
        img.setAltText(name);
        img.setSortOrder(0);
        productImageRepository.save(img);

        attributeValidationService.validateAndSaveProductAttributes(saved.getId(), productTypeId, attrs, false, false);

        for (SeedVariant sv : variants) {
            VariantEntity v = new VariantEntity();
            v.setId(UUID.randomUUID());
            v.setStoreId(storeId);
            v.setProductId(saved.getId());
            v.setSku(sv.sku());
            v.setTitle(sv.title());
            v.setStatus("ACTIVE");
            v.setCreatedAt(now);
            v.setUpdatedAt(now);
            VariantEntity savedV = variantRepository.saveAndFlush(v);

            sv.options().forEach((optName, optVal) -> {
                VariantOptionValueEntity ov = new VariantOptionValueEntity();
                ov.setId(UUID.randomUUID());
                ov.setVariantId(savedV.getId());
                ov.setOptionName(optName);
                ov.setOptionValue(optVal);
                variantOptionValueRepository.save(ov);
            });

            pricingService.upsertVariantPrice(
                    storeId,
                    savedV.getId(),
                    "USD",
                    new BigDecimal(sv.price()),
                    sv.compareAt() != null ? new BigDecimal(sv.compareAt()) : null
            );
            inventoryService.ensureVariantStock(storeId, savedV.getId(), savedV.getSku(), sv.stock());
        }
        return saved;
    }

    private void createCollection(UUID storeId, String slug, String name, String desc, List<UUID> productIds, Instant now) {
        CollectionEntity col = new CollectionEntity();
        col.setId(UUID.randomUUID());
        col.setStoreId(storeId);
        col.setSlug(slug);
        col.setName(name);
        col.setDescription(desc);
        col.setCreatedAt(now);
        col.setUpdatedAt(now);
        CollectionEntity saved = collectionRepository.save(col);
        for (int i = 0; i < productIds.size(); i++) {
            CollectionEntity.CollectionProductEntity cp = new CollectionEntity.CollectionProductEntity();
            cp.setId(new CollectionEntity.CollectionProductId(saved.getId(), productIds.get(i)));
            cp.setSortOrder(i);
            collectionProductRepository.save(cp);
        }
    }

    private void createPromo(
            UUID storeId, String code, String name, String type, BigDecimal value, String scopeType,
            Instant startsAt, Instant endsAt, int limit, String status, List<UUID> targets, Instant now
    ) {
        PromotionEntity promo = new PromotionEntity();
        promo.setId(UUID.randomUUID());
        promo.setStoreId(storeId);
        promo.setCode(code);
        promo.setName(name);
        promo.setType(type);
        promo.setValue(value);
        promo.setScopeType(scopeType);
        promo.setStartsAt(startsAt);
        promo.setEndsAt(endsAt);
        promo.setUsageLimit(limit);
        promo.setUsedCount(0);
        promo.setStackable(false);
        promo.setStatus(status);
        promo.setCreatedAt(now);
        promo.setUpdatedAt(now);
        PromotionEntity saved = promotionRepository.save(promo);
        for (UUID tid : targets) {
            PromotionTargetEntity t = new PromotionTargetEntity();
            t.setId(UUID.randomUUID());
            t.setPromotionId(saved.getId());
            t.setTargetType(scopeType);
            t.setTargetId(tid);
            promotionTargetRepository.save(t);
        }
    }

    private void seedOrder(
            UUID storeId, String orderNumber, String customerName, String email,
            String status, String payStatus, String fulfillStatus,
            String sub, String disc, String ship, String grand, String promoCode,
            ProductEntity prod, String sku, String variantTitle, BigDecimal unitPrice, int qty,
            String line1, String city, String state, String postal, Instant createdAt
    ) {
        UUID variantId = variantRepository.findByStoreIdAndSkuIgnoreCase(storeId, sku)
                .map(VariantEntity::getId)
                .orElseGet(UUID::randomUUID);

        OrderEntity order = new OrderEntity();
        order.setId(UUID.randomUUID());
        order.setStoreId(storeId);
        order.setOrderNumber(orderNumber);
        order.setCustomerName(customerName);
        order.setCustomerEmail(email);
        order.setStatus(status);
        order.setPaymentStatus(payStatus);
        order.setFulfillmentStatus(fulfillStatus);
        order.setCurrency("USD");
        order.setSubtotal(new BigDecimal(sub));
        order.setDiscountTotal(new BigDecimal(disc));
        order.setShippingTotal(new BigDecimal(ship));
        order.setTaxTotal(BigDecimal.ZERO);
        order.setGrandTotal(new BigDecimal(grand));
        order.setPromotionCode(promoCode);
        order.setTrackingNumber("DELIVERED".equals(status) ? "1Z999AA101928374" : "");
        order.setCreatedAt(createdAt);
        order.setUpdatedAt(createdAt);
        OrderEntity saved = orderRepository.save(order);

        OrderItemEntity item = new OrderItemEntity();
        item.setId(UUID.randomUUID());
        item.setOrderId(saved.getId());
        item.setProductId(prod.getId());
        item.setVariantId(variantId);
        item.setProductName(prod.getName());
        item.setVariantTitle(variantTitle);
        item.setSku(sku);
        item.setUnitPrice(unitPrice);
        item.setQuantity(qty);
        item.setLineTotal(unitPrice.multiply(BigDecimal.valueOf(qty)));
        orderItemRepository.save(item);

        OrderAddressEntity addr = new OrderAddressEntity();
        addr.setId(UUID.randomUUID());
        addr.setOrderId(saved.getId());
        addr.setKind("SHIPPING");
        addr.setFullName(customerName);
        addr.setLine1(line1);
        addr.setCity(city);
        addr.setState(state);
        addr.setPostalCode(postal);
        addr.setCountry("US");
        orderAddressRepository.save(addr);

        PaymentEntity pay = new PaymentEntity();
        pay.setId(UUID.randomUUID());
        pay.setOrderId(saved.getId());
        pay.setProvider("SANDBOX");
        pay.setStatus("CAPTURED");
        pay.setAmount(saved.getGrandTotal());
        pay.setCurrency("USD");
        pay.setExternalRef("seed_" + orderNumber.toLowerCase());
        pay.setCreatedAt(createdAt);
        paymentRepository.save(pay);

        OrderEventEntity ev = new OrderEventEntity();
        ev.setId(UUID.randomUUID());
        ev.setOrderId(saved.getId());
        ev.setKind("placed");
        ev.setLabel("Order placed");
        ev.setDetail("Seeded order record");
        ev.setCreatedAt(createdAt);
        orderEventRepository.save(ev);
    }

    private record SeedVariant(String sku, String title, String price, String compareAt, int stock, Map<String, String> options) {
    }
}
