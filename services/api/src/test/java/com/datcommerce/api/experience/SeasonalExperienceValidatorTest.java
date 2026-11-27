package com.datcommerce.api.experience;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.datcommerce.api.common.exception.ApiException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SeasonalExperienceValidatorTest {

    private final SeasonalExperienceValidator validator = new SeasonalExperienceValidator();

    @Test
    void validatesAllTemplatesCleanly() {
        for (SeasonalExperienceDtos.TemplateDto tpl : SeasonalExperienceTemplates.all()) {
            Map<String, Object> normalized = validator.validateAndNormalizeConfig(tpl.config());
            assertThat(normalized.get("schemaVersion")).isEqualTo(1);
            assertThat(normalized.get("layers")).isInstanceOf(List.class);
        }
        assertThat(SeasonalExperienceTemplates.all()).hasSize(10);
    }

    @Test
    void validatesAllFourteenLayerTypesAndClampsBounds() {
        List<Map<String, Object>> layers = SeasonalExperienceValidator.LAYER_TYPES.stream()
                .map(type -> Map.<String, Object>of(
                        "id", "layer-" + type,
                        "type", type,
                        "label", "Layer " + type,
                        "enabled", true,
                        "zIndex", 999,
                        "opacity", 5.0,
                        "props", Map.of()
                ))
                .toList();

        Map<String, Object> normalized = validator.validateAndNormalizeConfig(Map.of(
                "schemaVersion", 1,
                "themeOverride", Map.of("enabled", true, "mode", "dark_luxe", "colors", Map.of("primary", "#eab308")),
                "layers", layers
        ));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> outLayers = (List<Map<String, Object>>) normalized.get("layers");
        assertThat(outLayers).hasSize(14);
        assertThat(outLayers.getFirst().get("zIndex")).isEqualTo(60);
        assertThat(outLayers.getFirst().get("opacity")).isEqualTo(1.0);
        @SuppressWarnings("unchecked")
        Map<String, Object> theme = (Map<String, Object>) normalized.get("themeOverride");
        @SuppressWarnings("unchecked")
        Map<String, Object> colors = (Map<String, Object>) theme.get("colors");
        assertThat(colors.get("primary")).isEqualTo("#EAB308");
    }

    @Test
    void rejectsXssScriptsAndUnsafeUrls() {
        Map<String, Object> badScript = Map.of(
                "layers", List.of(Map.of(
                        "id", "xss-1",
                        "type", "promo_banner",
                        "label", "Bad Banner",
                        "props", Map.of("headline", "<script>alert(1)</script>")
                ))
        );
        assertThatThrownBy(() -> validator.validateAndNormalizeConfig(badScript))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Unsafe");

        Map<String, Object> badJsUrl = new LinkedHashMap<>();
        badJsUrl.put("layers", List.of(Map.of(
                "id", "xss-2",
                "type", "floating_sticker",
                "label", "Bad Sticker",
                "props", Map.of("text", "SALE", "linkUrl", "javascript:alert(1)")
        )));
        assertThatThrownBy(() -> validator.validateAndNormalizeConfig(badJsUrl))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsInvalidScheduleRangeAndBadHex() {
        Instant now = Instant.parse("2026-12-01T00:00:00Z");
        assertThatThrownBy(() -> validator.validateScheduleRange(now, now.minusSeconds(60)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("endsAt");

        Map<String, Object> badColor = Map.of(
                "themeOverride", Map.of("enabled", true, "colors", Map.of("primary", "red"))
        );
        assertThatThrownBy(() -> validator.validateAndNormalizeConfig(badColor))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("6-digit hex");
    }
}
