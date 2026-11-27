package com.datcommerce.api.experience;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SeasonalExperienceResolverServiceTest {

    private SeasonalExperienceRepository expRepo;
    private SeasonalExperienceVersionRepository verRepo;
    private SeasonalExperienceSettingsRepository settingsRepo;
    private SeasonalExperienceResolverService resolver;

    private final UUID storeId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        expRepo = mock(SeasonalExperienceRepository.class);
        verRepo = mock(SeasonalExperienceVersionRepository.class);
        settingsRepo = mock(SeasonalExperienceSettingsRepository.class);
        resolver = new SeasonalExperienceResolverService(expRepo, verRepo, settingsRepo);
    }

    @Test
    void stacksNonConflictingLayersAndSuppressesCompetingWeatherParticles() {
        Instant now = Instant.parse("2026-12-20T12:00:00Z");

        SeasonalExperienceSettingsEntity settings = SeasonalExperienceResolverService.defaultSettings(storeId);
        settings.setGlobalParticleCap(160);
        settings.setMaxConcurrentExperiences(3);
        when(settingsRepo.findById(storeId)).thenReturn(Optional.of(settings));

        // Higher priority Flash Sale (STACK) + Christmas (OVERRIDE) + lower priority Spring (OVERRIDE)
        UUID flashId = UUID.randomUUID();
        UUID flashVerId = UUID.randomUUID();
        SeasonalExperienceEntity flash = exp(flashId, "Flash Sale", "FLASH_SALE", "ACTIVE", "SCHEDULED", false,
                now.minusSeconds(600), now.plusSeconds(3600), 95, "STACK",
                List.of("top_banner"), flashVerId, now);
        SeasonalExperienceVersionEntity flashVer = ver(flashVerId, flashId, SeasonalExperienceTemplates.findByKey("flash-sale-surge").config());

        UUID xmasId = UUID.randomUUID();
        UUID xmasVerId = UUID.randomUUID();
        SeasonalExperienceEntity xmas = exp(xmasId, "Christmas", "HOLIDAY", "ACTIVE", "MANUAL", false,
                null, null, 70, "OVERRIDE",
                List.of("weather_particles", "theme_palette", "header_decor", "corner_decor", "top_banner"), xmasVerId, now);
        SeasonalExperienceVersionEntity xmasVer = ver(xmasVerId, xmasId, SeasonalExperienceTemplates.findByKey("christmas-wonderland").config());

        UUID springId = UUID.randomUUID();
        UUID springVerId = UUID.randomUUID();
        SeasonalExperienceEntity spring = exp(springId, "Spring", "SEASON", "ACTIVE", "MANUAL", false,
                null, null, 40, "OVERRIDE",
                List.of("weather_particles", "theme_palette", "corner_decor"), springVerId, now);
        SeasonalExperienceVersionEntity springVer = ver(springVerId, springId, SeasonalExperienceTemplates.findByKey("spring-blossoms").config());

        when(expRepo.findAllByStoreIdOrderByPriorityDescUpdatedAtDesc(storeId))
                .thenReturn(List.of(flash, xmas, spring));
        when(verRepo.findByIdAndExperienceId(flashVerId, flashId)).thenReturn(Optional.of(flashVer));
        when(verRepo.findByIdAndExperienceId(xmasVerId, xmasId)).thenReturn(Optional.of(xmasVer));
        when(verRepo.findByIdAndExperienceId(springVerId, springId)).thenReturn(Optional.of(springVer));

        SeasonalExperienceDtos.ResolvedStorefrontExperienceDto res = resolver.resolveForStore(storeId, now, null);

        assertThat(res.enabled()).isTrue();
        // Flash Sale + Christmas both compose; Spring is suppressed because its groups are claimed
        assertThat(res.activeExperiences()).extracting(SeasonalExperienceDtos.ActiveExperienceSummaryDto::name)
                .containsExactly("Flash Sale", "Christmas");
        // Flash Sale countdown stays, Christmas snow + santa + lights stay, Christmas promo_banner suppressed by top_banner group
        assertThat(res.layers()).extracting(SeasonalExperienceDtos.ResolvedExperienceLayerDto::type)
                .contains("countdown_bar", "santa_sleigh", "string_lights", "snowfall")
                .doesNotContain("blossom_petals");
        assertThat(res.nextTransitionAt()).isEqualTo(now.plusSeconds(3600));
    }

    @Test
    void enforcesExclusiveModeAndScalesParticleBudget() {
        Instant now = Instant.parse("2026-11-27T12:00:00Z");
        SeasonalExperienceSettingsEntity settings = SeasonalExperienceResolverService.defaultSettings(storeId);
        settings.setGlobalParticleCap(40);
        when(settingsRepo.findById(storeId)).thenReturn(Optional.of(settings));

        UUID bfId = UUID.randomUUID();
        UUID bfVerId = UUID.randomUUID();
        SeasonalExperienceEntity bf = exp(bfId, "Black Friday", "CAMPAIGN", "ACTIVE", "MANUAL", false,
                null, null, 90, "EXCLUSIVE", List.of("weather_particles", "theme_palette"), bfVerId, now);
        SeasonalExperienceVersionEntity bfVer = ver(bfVerId, bfId, SeasonalExperienceTemplates.findByKey("black-friday-luxe").config());

        UUID winterId = UUID.randomUUID();
        UUID winterVerId = UUID.randomUUID();
        SeasonalExperienceEntity winter = exp(winterId, "Winter", "SEASON", "ACTIVE", "MANUAL", false,
                null, null, 50, "STACK", List.of(), winterVerId, now);
        SeasonalExperienceVersionEntity winterVer = ver(winterVerId, winterId, SeasonalExperienceTemplates.findByKey("winter-snowfall").config());

        when(expRepo.findAllByStoreIdOrderByPriorityDescUpdatedAtDesc(storeId))
                .thenReturn(List.of(bf, winter));
        when(verRepo.findByIdAndExperienceId(bfVerId, bfId)).thenReturn(Optional.of(bfVer));
        when(verRepo.findByIdAndExperienceId(winterVerId, winterId)).thenReturn(Optional.of(winterVer));

        SeasonalExperienceDtos.ResolvedStorefrontExperienceDto res = resolver.resolveForStore(storeId, now, null);

        assertThat(res.activeExperiences()).hasSize(1);
        assertThat(res.activeExperiences().getFirst().name()).isEqualTo("Black Friday");
        assertThat(res.layers().stream()
                .filter(l -> "golden_particles".equals(l.type()))
                .findFirst().orElseThrow().effectiveDensityScale()).isLessThan(1.0);
        assertThat(res.resolutionTrace()).anyMatch(t -> t.contains("EXCLUSIVE"));
    }

    private static SeasonalExperienceEntity exp(
            UUID id, String name, String category, String status, String activationMode, boolean manualOverride,
            Instant startsAt, Instant endsAt, int priority, String blendMode, List<String> groups,
            UUID activeVerId, Instant updatedAt
    ) {
        SeasonalExperienceEntity e = new SeasonalExperienceEntity();
        e.setId(id);
        e.setSlug(name.toLowerCase().replace(" ", "-"));
        e.setName(name);
        e.setCategory(category);
        e.setStatus(status);
        e.setActivationMode(activationMode);
        e.setManualOverride(manualOverride);
        e.setStartsAt(startsAt);
        e.setEndsAt(endsAt);
        e.setTimezone("UTC");
        e.setRecurrenceRule("NONE");
        e.setPriority(priority);
        e.setBlendMode(blendMode);
        e.setExclusiveGroupsJson(groups);
        e.setTargetPagesJson(List.of("*"));
        e.setMaxParticleBudget(120);
        e.setActiveVersionId(activeVerId);
        e.setLatestVersionNumber(1);
        e.setUpdatedAt(updatedAt);
        return e;
    }

    private static SeasonalExperienceVersionEntity ver(UUID id, UUID expId, Map<String, Object> config) {
        SeasonalExperienceVersionEntity v = new SeasonalExperienceVersionEntity();
        v.setId(id);
        v.setExperienceId(expId);
        v.setVersionNumber(1);
        v.setConfigJson(config);
        v.setCreatedAt(Instant.now());
        return v;
    }
}
