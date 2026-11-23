package com.datcommerce.api.cms;

import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(3)
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DevCmsSeeder implements ApplicationRunner {

    private final StoreRepository storeRepository;
    private final PageRepository pageRepository;
    private final PageVersionRepository pageVersionRepository;
    private final ThemeConfigRepository themeConfigRepository;
    private final NavigationMenuRepository navigationMenuRepository;

    public DevCmsSeeder(
            StoreRepository storeRepository,
            PageRepository pageRepository,
            PageVersionRepository pageVersionRepository,
            ThemeConfigRepository themeConfigRepository,
            NavigationMenuRepository navigationMenuRepository
    ) {
        this.storeRepository = storeRepository;
        this.pageRepository = pageRepository;
        this.pageVersionRepository = pageVersionRepository;
        this.themeConfigRepository = themeConfigRepository;
        this.navigationMenuRepository = navigationMenuRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        StoreEntity store = storeRepository.findByCode("terrain-supply").orElse(null);
        if (store == null) {
            return;
        }
        UUID storeId = store.getId();
        Instant now = Instant.now();

        if (themeConfigRepository.findAllByStoreIdOrderByVersionNumberDesc(storeId).isEmpty()) {
            ThemeConfigEntity theme = new ThemeConfigEntity();
            theme.setId(UUID.randomUUID());
            theme.setStoreId(storeId);
            theme.setVersionNumber(1);
            theme.setStatus("PUBLISHED");
            theme.setTokensJson(ThemeTokenValidator.defaultTokens());
            theme.setNote("Initial Terrain & Dat Commerce theme");
            theme.setPublishedAt(now);
            theme.setCreatedAt(now);
            themeConfigRepository.save(theme);
        }

        if (navigationMenuRepository.findByStoreIdAndMenuKeyIgnoreCase(storeId, "main").isEmpty()) {
            NavigationMenuEntity nav = new NavigationMenuEntity();
            nav.setId(UUID.randomUUID());
            nav.setStoreId(storeId);
            nav.setMenuKey("main");
            nav.setItemsJson(List.of(
                    Map.of("id", "home", "label", "Home", "url", "/store"),
                    Map.of("id", "shop", "label", "Shop", "url", "/store/shop"),
                    Map.of("id", "categories", "label", "Categories", "url", "/store/categories"),
                    Map.of("id", "collections", "label", "Collections", "url", "/store/collections"),
                    Map.of("id", "about", "label", "About", "url", "/store/about"),
                    Map.of("id", "contact", "label", "Contact", "url", "/store/contact")
            ));
            nav.setUpdatedAt(now);
            navigationMenuRepository.save(nav);
        }

        if (pageRepository.findAllByStoreIdOrderBySlugAsc(storeId).isEmpty()) {
            seedPage(storeId, "home", "Home page",
                    "Terrain & Dat Commerce — Multi-Category Technical Store",
                    "Trail footwear, precision laptops, and alpine essentials.",
                    homeBlocks(), now);
            seedPage(storeId, "about", "About page",
                    "About Terrain Supply",
                    "Designed in Portland and tested across the Pacific Northwest.",
                    aboutBlocks(), now);
            seedPage(storeId, "collections", "Collections page",
                    "Curated Collections",
                    "Seasonal capsules uniting trail hardware and studio tools.",
                    collectionBlocks(), now);
        }
    }

    private void seedPage(
            UUID storeId,
            String slug,
            String title,
            String seoTitle,
            String seoDescription,
            List<Map<String, Object>> blocks,
            Instant now
    ) {
        UUID pageId = UUID.randomUUID();
        UUID verId = UUID.randomUUID();

        PageEntity page = new PageEntity();
        page.setId(pageId);
        page.setStoreId(storeId);
        page.setSlug(slug);
        page.setTitle(title);
        page.setStatus("PUBLISHED");
        page.setSeoTitle(seoTitle);
        page.setSeoDescription(seoDescription);
        page.setPublishedVersionId(verId);
        page.setLatestVersionNumber(1);
        page.setCreatedAt(now);
        page.setUpdatedAt(now);
        pageRepository.saveAndFlush(page);

        PageVersionEntity ver = new PageVersionEntity();
        ver.setId(verId);
        ver.setPageId(pageId);
        ver.setVersionNumber(1);
        ver.setContentJson(Map.of("version", 1, "blocks", blocks));
        ver.setChangeSummary("Initial seeded page");
        ver.setCreatedAt(now);
        pageVersionRepository.save(ver);
    }

    private static List<Map<String, Object>> homeBlocks() {
        return List.of(
                block("hero", "hero", "Hero banner", props(
                        "AUTUMN / STUDIO & FIELD",
                        "Engineered for where the road ends.",
                        "Purpose-built footwear, weatherproof apparel, and precision studio hardware designed for life in motion.",
                        "Shop the collection", "/store/shop", "/media/terrain-hero.jpg",
                        "forest", "overlay", "regular", 4, null
                )),
                block("categories", "featured_categories", "Featured Categories", props(
                        "SHOP BY DEPARTMENT",
                        "Curated across every terrain.",
                        "Explore trail-tested gear alongside precision mobile workstations.",
                        "All categories", "/store/categories", "/media/shoe-olive.jpg",
                        "light", "overlay", "regular", 4, null
                )),
                block("best", "best_sellers", "Best Sellers", props(
                        "COMMUNITY FAVORITES",
                        "Most requested right now.",
                        "Proven performers backed by verified field and studio reviews.",
                        "Shop best sellers", "/store/shop", "/media/shoe-olive.jpg",
                        "light", "overlay", "regular", 4, null
                )),
                block("promo", "promotional_banner", "Promotional Banner", props(
                        "SEASONAL OFFER · CODE WELCOME15",
                        "Take 15% off your first complete kit.",
                        "Use code WELCOME15 at checkout — valid across orders storewide.",
                        "Claim offer", "/store/shop", "/media/pack.jpg",
                        "light", "centered", "regular", 3, null
                )),
                block("arrivals", "product_grid", "Product Grid", props(
                        "NEW ARRIVALS",
                        "Fresh off the workbench.",
                        "Latest releases across footwear, laptops, and connected devices.",
                        "View all arrivals", "/store/shop", "/media/laptop-pro.svg",
                        "light", "overlay", "regular", 4, null
                )),
                block("collection", "collection_banner", "Collection Banner", props(
                        "LIMITED CAPSULE",
                        "The Alpine & Studio Capsule",
                        "Pair ultra-light storm protection with silent portable computing for remote field assignments.",
                        "Explore collections", "/store/collections", "/media/jacket.jpg",
                        "ink", "split", "regular", 3, null
                )),
                block("testimonials", "testimonials", "Testimonials", props(
                        "VERIFIED REVIEWS",
                        "Trusted in the field and studio.",
                        "Real feedback from designers, engineers, and mountain runners.",
                        "", "/store/shop", "/media/terrain-hero.jpg",
                        "light", "centered", "regular", 3,
                        List.of(
                                Map.of("id", "t1", "title", "Elena Vance", "subtitle", "Industrial Designer", "body", "FormaBook Pro 14 handles CAD renders silently on the train and all day off grid."),
                                Map.of("id", "t2", "title", "Marcus Thorne", "subtitle", "Ultra Trail Runner", "body", "Ridge Runner GTX gripped slick granite on a 50K loop without a single blister."),
                                Map.of("id", "t3", "title", "Kai Lindstrom", "subtitle", "Documentary DP", "body", "Everything from the Summit Shell to the titanium phone feels built by the same disciplined team.")
                        )
                )),
                block("newsletter", "newsletter", "Newsletter", props(
                        "FIELD DISPATCH",
                        "Small-batch releases & studio notes.",
                        "Receive quiet updates on hardware drops, trail footwear restocks, and repair guides.",
                        "Subscribe", "/store/shop", "/media/terrain-fallback.jpg",
                        "forest", "centered", "regular", 3, null
                ))
        );
    }

    private static List<Map<String, Object>> aboutBlocks() {
        return List.of(
                block("about-hero", "hero", "Studio story", props(
                        "OUR PRACTICE",
                        "Designed for field reliability and studio calm.",
                        "Terrain Supply builds modular outdoor essentials alongside precision computing tools.",
                        "Explore catalog", "/store/shop", "/media/terrain-fallback.jpg",
                        "ink", "split", "regular", 3, null
                )),
                block("about-story", "image_with_text", "Design philosophy", props(
                        "MATERIALS & LONGEVITY",
                        "Fewer pieces, built to outlast trends.",
                        "Every product starts with repairable assemblies, recycled membranes, and open specifications.",
                        "Contact us", "/store/contact", "/media/jacket.jpg",
                        "light", "split", "regular", 3, null
                )),
                block("about-faq", "faq", "FAQ", props(
                        "WARRANTY & RETURNS",
                        "Frequently asked questions.",
                        "Clear policies on trials, shipping, and hardware repair.",
                        "", "/store/contact", "/media/terrain-fallback.jpg",
                        "light", "centered", "regular", 3,
                        List.of(
                                Map.of("id", "f1", "title", "What is your return policy?", "body", "30-day field trial on all footwear, apparel, and hardware."),
                                Map.of("id", "f2", "title", "How fast do orders ship?", "body", "Orders placed before 2:00 PM PT dispatch the same business day.")
                        )
                ))
        );
    }

    private static List<Map<String, Object>> collectionBlocks() {
        return List.of(
                block("col-banner", "collection_banner", "Seasonal Capsule", props(
                        "CURATED DROPS",
                        "Field Essentials & Trail Hardware",
                        "Explore cross-category bundles curated by our product editors.",
                        "Shop all products", "/store/shop", "/media/pack.jpg",
                        "forest", "split", "regular", 3, null
                ))
        );
    }

    private static Map<String, Object> block(String id, String type, String label, Map<String, Object> props) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("type", type);
        m.put("version", 1);
        m.put("label", label);
        m.put("visible", true);
        m.put("props", props);
        return m;
    }

    private static Map<String, Object> props(
            String kicker,
            String heading,
            String copy,
            String action,
            String actionUrl,
            String image,
            String tone,
            String layout,
            String scale,
            int columns,
            List<Map<String, Object>> items
    ) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("kicker", kicker);
        p.put("heading", heading);
        p.put("copy", copy);
        p.put("action", action);
        p.put("actionUrl", actionUrl);
        p.put("image", image);
        p.put("tone", tone);
        p.put("layout", layout);
        p.put("scale", scale);
        p.put("spacing", "comfortable");
        p.put("columns", columns);
        if (items != null) {
            p.put("items", items);
        }
        return p;
    }
}
