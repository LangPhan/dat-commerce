package com.datcommerce.api.experience;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class SeasonalExperienceTemplates {

    private SeasonalExperienceTemplates() {
    }

    public static List<SeasonalExperienceDtos.TemplateDto> all() {
        return List.of(
                winterSnowfall(),
                springBlossoms(),
                christmasWonderland(),
                lunarNewYear(),
                valentinesRomance(),
                blackFridayLuxe(),
                flashSaleSurge(),
                autumnHarvest(),
                halloweenNight(),
                summerSunburst()
        );
    }

    public static SeasonalExperienceDtos.TemplateDto findByKey(String presetKey) {
        if (presetKey == null) return null;
        return all().stream()
                .filter(t -> t.presetKey().equalsIgnoreCase(presetKey.trim()))
                .findFirst()
                .orElse(null);
    }

    private static SeasonalExperienceDtos.TemplateDto winterSnowfall() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#0284C7", "accent", "#38BDF8"),
                        "#F0F9FF",
                        backdrop("vignette", "#BAE6FD", "#E0F2FE", 0.34),
                        Map.of("announcementBg", "#0C4A6E", "announcementTextColor", "#F0F9FF",
                                "announcementText", "Winter Frost Collection — Free thermal shipping over {freeShippingThreshold}"),
                        cta(false, "", "#38BDF8", false)
                ),
                List.of(
                        layer("winter-glow", "ambient_glow", "Arctic Frost Vignette", "viewport_overlay", 10, 0.55, "screen",
                                Map.of("style", "frost_vignette", "primaryColor", "#BAE6FD", "secondaryColor", "#38BDF8", "intensity", 0.42)),
                        layer("winter-snow-back", "snowfall", "Gentle Distant Snow", "viewport_overlay", 24, 0.68, "normal",
                                Map.of("density", 55, "speed", 0.75, "wind", 0.25, "sizeMin", 1.5, "sizeMax", 4.0, "color", "#FFFFFF", "variant", "soft_bokeh")),
                        layer("winter-snow-front", "snowfall", "Crystal Snowflakes", "viewport_overlay", 28, 0.92, "normal",
                                Map.of("density", 45, "speed", 1.15, "wind", 0.45, "sizeMin", 3.5, "sizeMax", 9.0, "color", "#E0F2FE", "variant", "crystal_flakes"))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "winter-snowfall",
                "Winter Snowfall",
                "SEASON",
                "Layered crystalline & soft bokeh snowfall with crisp arctic frost vignette and alpine sky accent tint.",
                "#0284C7",
                "linear-gradient(135deg, #0C4A6E 0%, #0284C7 55%, #BAE6FD 100%)",
                List.of("Winter", "Snow", "Frost", "Particles"),
                40,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "ambient_backdrop"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto springBlossoms() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#DB2777", "accent", "#F472B6"),
                        "#FFF1F2",
                        backdrop("top_aurora", "#FBCFE8", "#FEF08A", 0.28),
                        Map.of("announcementBg", "#831843", "announcementTextColor", "#FDF2F8",
                                "announcementText", "Spring Blossom Arrivals — Fresh seasonal silhouettes are here"),
                        cta(false, "", "#F472B6", false)
                ),
                List.of(
                        layer("spring-aurora", "ambient_glow", "Spring Morning Glow", "viewport_overlay", 10, 0.45, "screen",
                                Map.of("style", "aurora_ribbon", "primaryColor", "#FBCFE8", "secondaryColor", "#FDE047", "intensity", 0.3)),
                        layer("spring-cherry", "blossom_petals", "Falling Cherry Blossoms", "viewport_overlay", 26, 0.92, "normal",
                                Map.of("species", "cherry_blossom", "density", 42, "speed", 0.85, "swayAmplitude", 1.35, "tumble3d", true,
                                        "colors", List.of("#FBCFE8", "#F9A8D4", "#FDF2F8"))),
                        layer("spring-apricot", "blossom_petals", "Golden Apricot Petals", "viewport_overlay", 28, 0.88, "normal",
                                Map.of("species", "apricot_blossom", "density", 24, "speed", 0.95, "swayAmplitude", 1.1, "tumble3d", true,
                                        "colors", List.of("#FDE047", "#FACC15", "#FEF08A"))),
                        layer("spring-corner", "corner_floral_frame", "Cherry Blossom Corner Frame", "viewport_overlay", 34, 0.95, "normal",
                                Map.of("motif", "cherry_branch", "corners", List.of("top-left", "top-right"), "scale", 1.0, "sway", true,
                                        "primaryColor", "#F472B6", "accentColor", "#FDE047"))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "spring-blossoms",
                "Spring Blossoms",
                "SEASON",
                "3D tumbling cherry blossoms & golden apricot blossoms with botanical corner branches and soft sakura accents.",
                "#DB2777",
                "linear-gradient(135deg, #9D174D 0%, #F472B6 60%, #FEF08A 100%)",
                List.of("Spring", "Cherry Blossom", "Apricot Blossom", "Floral"),
                40,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "corner_decor"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto christmasWonderland() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#166534", "accent", "#DC2626"),
                        "#FEF2F2",
                        backdrop("top_aurora", "#DC2626", "#16A34A", 0.22),
                        Map.of("announcementBg", "#14532D", "announcementTextColor", "#FEFCE8",
                                "announcementText", "Holiday Gift Guide — Free gift wrapping & express holiday dispatch"),
                        cta(true, "GIFT PICK", "#DC2626", true)
                ),
                List.of(
                        layer("xmas-banner", "promo_banner", "Christmas Holiday Ribbon", "top_announcement", 45, 1.0, "normal",
                                promoProps("CHRISTMAS", "Merry Christmas! Enjoy 20% off curated holiday kits",
                                        "Guaranteed arrival before Dec 24", "XMAS20",
                                        "Shop Gifts", "/store/shop", "#7F1D1D", "#FEFCE8", "#FACC15", "shimmer", true)),
                        layer("xmas-lights", "string_lights", "Twinkling Christmas Lights", "header_frame", 42, 0.98, "normal",
                                Map.of("style", "christmas_bulbs", "bulbCount", 24, "twinkleSpeed", 1.15, "glowIntensity", 0.85,
                                        "wireColor", "#1E293B", "colors", List.of("#EF4444", "#22C55E", "#FACC15", "#3B82F6"))),
                        layer("xmas-sleigh", "santa_sleigh", "Santa & Reindeer Sleigh", "hero_stage", 38, 0.98, "normal",
                                Map.of("flightIntervalSeconds", 14, "flightDurationSeconds", 9, "altitudePct", 12, "direction", "ltr",
                                        "scale", 1.0, "trailSparkles", true, "sleighColor", "#B91C1C", "glowColor", "#FDE047")),
                        layer("xmas-snow", "snowfall", "Christmas Eve Snowfall", "viewport_overlay", 26, 0.9, "normal",
                                Map.of("density", 85, "speed", 1.0, "wind", 0.35, "sizeMin", 2.0, "sizeMax", 8.0,
                                        "color", "#FFFFFF", "variant", "mixed")),
                        layer("xmas-corners", "corner_floral_frame", "Pine & Holly Corners", "viewport_overlay", 34, 0.95, "normal",
                                Map.of("motif", "pine_holly", "corners", List.of("top-left", "top-right"), "scale", 1.0, "sway", true,
                                        "primaryColor", "#15803D", "accentColor", "#DC2626"))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "christmas-wonderland",
                "Christmas Wonderland",
                "HOLIDAY",
                "Santa Claus & reindeer sleigh gliding across the sky, twinkling string lights, falling snow, pine corners, and festive promo banner.",
                "#DC2626",
                "linear-gradient(135deg, #14532D 0%, #991B1B 55%, #FACC15 100%)",
                List.of("Christmas", "Santa Sleigh", "Lights", "Snow"),
                70,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "header_decor", "corner_decor", "top_banner"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto lunarNewYear() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#B91C1C", "accent", "#D97706"),
                        "#FFFBEB",
                        backdrop("radial_glow", "#EF4444", "#FACC15", 0.25),
                        Map.of("announcementBg", "#7F1D1D", "announcementTextColor", "#FEF08A",
                                "announcementText", "Chúc Mừng Năm Mới · Lunar New Year Lucky Red Envelope Savings"),
                        cta(true, "LUCKY", "#D97706", true)
                ),
                List.of(
                        layer("lny-banner", "promo_banner", "Lunar New Year Promo Ribbon", "top_announcement", 45, 1.0, "normal",
                                promoProps("LUNAR NEW YEAR", "Celebrate Prosperity — Unlock Lucky Red Envelope Deals",
                                        "Limited festive capsule & complimentary gift box", "TETLUCKY",
                                        "Explore Capsule", "/store/collections", "#991B1B", "#FEFCE8", "#FACC15", "shimmer", true)),
                        layer("lny-lanterns", "festive_lanterns", "Swaying Silk Lanterns", "header_frame", 42, 0.98, "normal",
                                Map.of("style", "lunar_silk", "count", 6, "swayIntensity", 1.1, "primaryColor", "#DC2626",
                                        "trimColor", "#FACC15", "emblemText", "福")),
                        layer("lny-fireworks", "fireworks", "Festive Celebration Fireworks", "viewport_overlay", 24, 0.92, "screen",
                                Map.of("burstRate", 0.85, "particleCount", 58, "gravity", 0.42, "launchZone", "top_sky", "trails", true,
                                        "colors", List.of("#EF4444", "#FACC15", "#FB923C", "#F472B6"))),
                        layer("lny-peach", "blossom_petals", "Peach & Apricot Blossoms", "viewport_overlay", 28, 0.9, "normal",
                                Map.of("species", "peach_blossom", "density", 44, "speed", 0.85, "swayAmplitude", 1.2, "tumble3d", true,
                                        "colors", List.of("#FB7185", "#FDA4AF", "#FACC15"))),
                        layer("lny-corners", "corner_floral_frame", "Peach & Apricot Corner Branches", "viewport_overlay", 34, 0.95, "normal",
                                Map.of("motif", "peach_branch", "corners", List.of("top-left", "top-right"), "scale", 1.05, "sway", true,
                                        "primaryColor", "#FB7185", "accentColor", "#FACC15"))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "lunar-new-year",
                "Lunar New Year (Tết)",
                "CULTURAL",
                "Crimson & gold fireworks, falling peach & apricot blossoms, swaying silk lanterns, auspicious corner branches, and lucky promo ribbon.",
                "#B91C1C",
                "linear-gradient(135deg, #7F1D1D 0%, #DC2626 55%, #FACC15 100%)",
                List.of("Lunar New Year", "Fireworks", "Peach Blossom", "Lanterns"),
                80,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "header_decor", "corner_decor", "top_banner"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto valentinesRomance() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#BE123C", "accent", "#FB7185"),
                        "#FFF1F2",
                        backdrop("radial_glow", "#FB7185", "#FECDD3", 0.3),
                        Map.of("announcementBg", "#881337", "announcementTextColor", "#FFF1F2",
                                "announcementText", "Valentine's Edit — Handpicked gifts made to last"),
                        cta(true, "LOVE", "#E11D48", false)
                ),
                List.of(
                        layer("val-aura", "ambient_glow", "Romantic Rose Aura", "viewport_overlay", 10, 0.5, "screen",
                                Map.of("style", "rose_aura", "primaryColor", "#FB7185", "secondaryColor", "#FDA4AF", "intensity", 0.35)),
                        layer("val-hearts", "floating_hearts", "Rising Glass-Glow Hearts", "viewport_overlay", 28, 0.9, "normal",
                                Map.of("density", 34, "speed", 0.85, "direction", "rise", "glow", true,
                                        "colors", List.of("#FB7185", "#F43F5E", "#FDA4AF"))),
                        layer("val-corners", "corner_floral_frame", "Romantic Floral Corners", "viewport_overlay", 34, 0.9, "normal",
                                Map.of("motif", "romantic_floral", "corners", List.of("top-left", "bottom-right"), "scale", 0.95, "sway", true,
                                        "primaryColor", "#E11D48", "accentColor", "#FDA4AF")),
                        layer("val-banner", "promo_banner", "Valentine Gift Banner", "top_announcement", 44, 1.0, "normal",
                                promoProps("VALENTINE'S DAY", "Gift Something Timeless — Complimentary Monogram Card",
                                        "Express courier available on all gift kits", "LOVE14",
                                        "Shop Gift Edit", "/store/shop", "#881337", "#FFF1F2", "#FDA4AF", "pulse_glow", true))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "valentines-romance",
                "Valentine's Day",
                "OCCASION",
                "Rising glass-glow floating hearts, soft rose atmospheric aura, romantic floral corners, and gift-ready promo bar.",
                "#E11D48",
                "linear-gradient(135deg, #881337 0%, #E11D48 55%, #FDA4AF 100%)",
                List.of("Valentine", "Hearts", "Romantic", "Gifts"),
                65,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "corner_decor", "top_banner"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto blackFridayLuxe() {
        Map<String, Object> config = cfg(
                themeOverride(true, "dark_luxe",
                        Map.of(
                                "primary", "#EAB308",
                                "secondary", "#18181B",
                                "accent", "#FACC15",
                                "background", "#0B0C10",
                                "surface", "#14161D",
                                "text", "#F8FAFC",
                                "muted", "#A1A1AA",
                                "border", "#27272A"
                        ),
                        "#18181B",
                        backdrop("radial_glow", "#EAB308", "#713F12", 0.25),
                        Map.of(
                                "bgColor", "#0E1015",
                                "textColor", "#F8FAFC",
                                "borderColor", "#27272A",
                                "announcementBg", "#000000",
                                "announcementTextColor", "#FACC15",
                                "announcementText", "BLACK FRIDAY PRIVATE ACCESS — UP TO 40% OFF SITEWIDE"
                        ),
                        cta(true, "VIP", "#EAB308", true)
                ),
                List.of(
                        layer("bf-banner", "promo_banner", "Black Friday VIP Banner", "top_announcement", 46, 1.0, "normal",
                                promoProps("BLACK FRIDAY", "Dark Luxe Event — Extra 20% Off Orders Over $150",
                                        "Limited allocation across flagship hardware & footwear", "BFGOLD20",
                                        "Unlock Deals", "/store/shop", "#09090B", "#FAFAFA", "#FACC15", "shimmer", false)),
                        layer("bf-countdown", "countdown_bar", "Black Friday Event Timer", "hero_stage", 44, 1.0, "normal",
                                Map.of("title", "Black Friday Vault Closes In", "syncWithExperienceEnd", true, "targetIso", "",
                                        "variant", "hero_ribbon", "bgColor", "#18181B", "textColor", "#FAFAFA",
                                        "digitBgColor", "#09090B", "urgentColor", "#FACC15",
                                        "ctaLabel", "Shop Vault", "ctaUrl", "/store/shop")),
                        layer("bf-gold", "golden_particles", "Drifting Golden Embers", "viewport_overlay", 26, 0.9, "screen",
                                Map.of("density", 70, "speed", 0.65, "shape", "sparkle_star", "twinkle", true,
                                        "colors", List.of("#FACC15", "#FDE047", "#D97706"))),
                        layer("bf-corners", "corner_floral_frame", "Art-Deco Gold Corners", "viewport_overlay", 34, 0.85, "normal",
                                Map.of("motif", "gold_deco", "corners", List.of("top-left", "top-right", "bottom-left", "bottom-right"),
                                        "scale", 0.95, "sway", false, "primaryColor", "#EAB308", "accentColor", "#FDE047"))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "black-friday-luxe",
                "Black Friday Dark Luxe",
                "CAMPAIGN",
                "Dramatic obsidian dark-mode takeover with champagne gold palette, shimmering VIP banner, golden embers, and Art-Deco corners.",
                "#CA8A04",
                "linear-gradient(135deg, #09090B 0%, #27272A 55%, #EAB308 100%)",
                List.of("Black Friday", "Dark Mode", "Gold Particles", "Campaign"),
                90,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "corner_decor", "top_banner", "promo_highlight"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto flashSaleSurge() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#EA580C", "accent", "#F59E0B"),
                        "#FFF7ED",
                        backdrop("top_aurora", "#EA580C", "#FACC15", 0.2),
                        Map.of("announcementBg", "#7C2D12", "announcementTextColor", "#FFEDD5",
                                "announcementText", "FLASH DROP LIVE NOW — Lightning deals end when the timer hits zero"),
                        cta(true, "FLASH DEAL", "#EA580C", true)
                ),
                List.of(
                        layer("flash-countdown", "countdown_bar", "Live Flash Countdown Bar", "top_announcement", 48, 1.0, "normal",
                                Map.of("title", "Flash Sale Ends In", "syncWithExperienceEnd", true, "targetIso", "",
                                        "variant", "full_bar", "bgColor", "#9A3412", "textColor", "#FFFFFF",
                                        "digitBgColor", "#431407", "urgentColor", "#FDE047",
                                        "ctaLabel", "Shop Flash Deals", "ctaUrl", "/store/shop")),
                        layer("flash-banner", "promo_banner", "Flash Ticker Banner", "hero_stage", 42, 1.0, "normal",
                                promoProps("FLASH SALE", "Up to 35% Off Featured Gear — Limited Stock Remaining",
                                        "Extra 10% at checkout with code FLASH10", "FLASH10",
                                        "Claim Deal", "/store/shop", "#18181B", "#FFFFFF", "#FB923C", "ticker", true)),
                        layer("flash-sticker", "floating_sticker", "Flash Drop Sticker", "floating_corner", 44, 1.0, "normal",
                                Map.of("text", "FLASH DROP", "subtext", "Use FLASH10", "icon", "flame",
                                        "anchor", "bottom-left", "offsetX", 2, "offsetY", 10,
                                        "bgColor", "#EA580C", "textColor", "#FFFFFF", "motion", "pulse", "linkUrl", "/store/shop")),
                        layer("flash-sparks", "confetti_burst", "Celebration Sparks", "viewport_overlay", 24, 0.72, "normal",
                                Map.of("density", 36, "speed", 0.95, "shapes", List.of("star", "ribbon"),
                                        "colors", List.of("#FB923C", "#FACC15", "#EF4444")))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "flash-sale-surge",
                "Flash Sale Surge",
                "FLASH_SALE",
                "Auto-synced countdown bar, animated promo ticker, pulsing CTA highlights, floating flash drop badge, and celebration sparks.",
                "#EA580C",
                "linear-gradient(135deg, #7C2D12 0%, #EA580C 55%, #FACC15 100%)",
                List.of("Flash Sale", "Countdown", "Urgency", "Promo"),
                95,
                "STACK",
                List.of("top_banner", "promo_highlight"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto autumnHarvest() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#B45309", "accent", "#D97706"),
                        "#FFFBEB",
                        backdrop("top_aurora", "#D97706", "#9A3412", 0.22),
                        Map.of("announcementBg", "#78350F", "announcementTextColor", "#FEF3C7",
                                "announcementText", "Autumn Trail Capsule — Crisp mornings call for layered warmth"),
                        cta(false, "", "#D97706", false)
                ),
                List.of(
                        layer("autumn-leaves", "blossom_petals", "Falling Maple & Autumn Leaves", "viewport_overlay", 26, 0.92, "normal",
                                Map.of("species", "autumn_leaf", "density", 38, "speed", 0.85, "swayAmplitude", 1.4, "tumble3d", true,
                                        "colors", List.of("#EA580C", "#D97706", "#B91C1C", "#F59E0B"))),
                        layer("autumn-glow", "ambient_glow", "Golden Hour Glow", "viewport_overlay", 12, 0.45, "screen",
                                Map.of("style", "gold_spotlight", "primaryColor", "#F59E0B", "secondaryColor", "#EA580C", "intensity", 0.3))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "autumn-harvest",
                "Autumn Harvest",
                "SEASON",
                "Tumbling autumn maple leaves and warm amber golden-hour atmospheric glow.",
                "#B45309",
                "linear-gradient(135deg, #78350F 0%, #D97706 60%, #FDE68A 100%)",
                List.of("Autumn", "Leaves", "Warm", "Season"),
                40,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "ambient_backdrop"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto halloweenNight() {
        Map<String, Object> config = cfg(
                themeOverride(true, "dark_luxe",
                        Map.of(
                                "primary", "#F97316",
                                "secondary", "#1E1B4B",
                                "accent", "#A855F7",
                                "background", "#0F0B1A",
                                "surface", "#1A132B",
                                "text", "#F5F3FF",
                                "muted", "#C4B5FD",
                                "border", "#31234D"
                        ),
                        "#1A132B",
                        backdrop("vignette", "#7E22CE", "#EA580C", 0.34),
                        Map.of("bgColor", "#140E22", "textColor", "#F5F3FF", "borderColor", "#31234D",
                                "announcementBg", "#4C1D95", "announcementTextColor", "#FFEDD5",
                                "announcementText", "Midnight Spooky Drop — Limited Edition Nocturnal Gear"),
                        cta(true, "SPOOKY", "#F97316", true)
                ),
                List.of(
                        layer("hal-embers", "golden_particles", "Floating Pumpkin Embers", "viewport_overlay", 24, 0.85, "screen",
                                Map.of("density", 55, "speed", 0.75, "shape", "gold_dust", "twinkle", true,
                                        "colors", List.of("#F97316", "#A855F7", "#FACC15"))),
                        layer("hal-corners", "corner_floral_frame", "Gothic Corner Webs", "viewport_overlay", 34, 0.88, "normal",
                                Map.of("motif", "spiderweb_gothic", "corners", List.of("top-left", "top-right"), "scale", 1.0, "sway", false,
                                        "primaryColor", "#A855F7", "accentColor", "#F97316")),
                        layer("hal-banner", "promo_banner", "Halloween Midnight Promo", "top_announcement", 45, 1.0, "normal",
                                promoProps("HALLOWEEN", "Nocturnal Archive Sale — Treat Yourself to 15% Off",
                                        "Ends at midnight", "SPOOKY15",
                                        "Enter the Vault", "/store/shop", "#2E1065", "#FFEDD5", "#F97316", "pulse_glow", true))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "halloween-night",
                "Halloween Night",
                "HOLIDAY",
                "Nocturnal dark purple & pumpkin orange takeover with drifting embers, gothic corner webs, and spooky midnight banner.",
                "#7E22CE",
                "linear-gradient(135deg, #0F0B1A 0%, #581C87 55%, #F97316 100%)",
                List.of("Halloween", "Dark Mode", "Embers", "Holiday"),
                70,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "corner_decor", "top_banner"),
                config
        );
    }

    private static SeasonalExperienceDtos.TemplateDto summerSunburst() {
        Map<String, Object> config = cfg(
                themeOverride(true, "accent_tint",
                        Map.of("primary", "#0D9488", "accent", "#F59E0B"),
                        "#F0FDFA",
                        backdrop("top_aurora", "#FDE047", "#2DD4BF", 0.25),
                        Map.of("announcementBg", "#134E4A", "announcementTextColor", "#FEFCE8",
                                "announcementText", "Summer Sunburst Edit — Breathable trailwear & studio packs"),
                        cta(false, "", "#0D9488", false)
                ),
                List.of(
                        layer("sum-glow", "ambient_glow", "Sunburst Horizon Glow", "viewport_overlay", 12, 0.5, "screen",
                                Map.of("style", "aurora_ribbon", "primaryColor", "#FACC15", "secondaryColor", "#2DD4BF", "intensity", 0.35)),
                        layer("sum-shimmer", "golden_particles", "Sunlit Golden Shimmer", "viewport_overlay", 24, 0.72, "screen",
                                Map.of("density", 40, "speed", 0.55, "shape", "sparkle_star", "twinkle", true,
                                        "colors", List.of("#FDE047", "#38BDF8", "#FDBA74"))),
                        layer("sum-banner", "promo_banner", "Summer Capsule Banner", "top_announcement", 44, 1.0, "normal",
                                promoProps("SUMMER EDIT", "Ultralight Summer Essentials — Free Express Shipping Over $100",
                                        "Built for high-output heat & travel", "SUMMER10",
                                        "Shop Summer", "/store/shop", "#115E59", "#FFFFFF", "#FDE047", "shimmer", true))
                )
        );
        return new SeasonalExperienceDtos.TemplateDto(
                "summer-sunburst",
                "Summer Sunburst",
                "SEASON",
                "Sunlit coastal aurora glow, warm golden sparkles, and vibrant summer capsule banner.",
                "#0D9488",
                "linear-gradient(135deg, #115E59 0%, #2DD4BF 55%, #FDE047 100%)",
                List.of("Summer", "Sunburst", "Shimmer", "Season"),
                40,
                "OVERRIDE",
                List.of("weather_particles", "theme_palette", "top_banner"),
                config
        );
    }

    private static Map<String, Object> promoProps(
            String badgeText,
            String headline,
            String subtext,
            String promoCode,
            String ctaLabel,
            String ctaUrl,
            String bgColor,
            String textColor,
            String accentColor,
            String animationStyle,
            boolean dismissible
    ) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("badgeText", badgeText);
        p.put("headline", headline);
        p.put("subtext", subtext);
        p.put("promoCode", promoCode);
        p.put("ctaLabel", ctaLabel);
        p.put("ctaUrl", ctaUrl);
        p.put("bgColor", bgColor);
        p.put("textColor", textColor);
        p.put("accentColor", accentColor);
        p.put("animationStyle", animationStyle);
        p.put("dismissible", dismissible);
        return p;
    }

    private static Map<String, Object> cfg(Map<String, Object> themeOverride, List<Map<String, Object>> layers) {
        Map<String, Object> motion = new LinkedHashMap<>();
        motion.put("respectReducedMotion", true);
        motion.put("mobileDensityRatio", 0.5);
        motion.put("pauseOnHiddenTab", true);

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("schemaVersion", 1);
        root.put("themeOverride", themeOverride);
        root.put("motion", motion);
        root.put("layers", layers);
        return root;
    }

    private static Map<String, Object> themeOverride(
            boolean enabled,
            String mode,
            Map<String, Object> colors,
            String surfaceTint,
            Map<String, Object> backdrop,
            Map<String, Object> headerOverride,
            Map<String, Object> ctaHighlight
    ) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("enabled", enabled);
        t.put("mode", mode);
        t.put("colors", new LinkedHashMap<>(colors));
        t.put("surfaceTint", surfaceTint);
        t.put("backdrop", backdrop);
        t.put("headerOverride", new LinkedHashMap<>(headerOverride));
        t.put("ctaHighlight", ctaHighlight);
        return t;
    }

    private static Map<String, Object> backdrop(String kind, String primaryColor, String secondaryColor, double opacity) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("kind", kind);
        b.put("primaryColor", primaryColor);
        b.put("secondaryColor", secondaryColor);
        b.put("opacity", opacity);
        return b;
    }

    private static Map<String, Object> cta(boolean enabled, String badgeText, String glowColor, boolean shimmer) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("enabled", enabled);
        c.put("badgeText", badgeText);
        c.put("glowColor", glowColor);
        c.put("shimmer", shimmer);
        return c;
    }

    private static Map<String, Object> layer(
            String id,
            String type,
            String label,
            String zone,
            int zIndex,
            double opacity,
            String blendMode,
            Map<String, Object> props
    ) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("id", id);
        l.put("type", type);
        l.put("label", label);
        l.put("enabled", true);
        l.put("locked", false);
        l.put("zone", zone);
        l.put("zIndex", zIndex);
        l.put("opacity", opacity);
        l.put("blendMode", blendMode);
        l.put("visibility", Map.of("desktop", true, "tablet", true, "mobile", true));
        l.put("trigger", "immediate");
        l.put("props", new LinkedHashMap<>(props));
        return l;
    }
}
