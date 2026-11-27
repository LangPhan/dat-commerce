package com.datcommerce.api.experience;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/experiences")
public class SeasonalExperienceAdminController {

    private final SeasonalExperienceService experienceService;
    private final ExperienceAiService experienceAiService;

    public SeasonalExperienceAdminController(
            SeasonalExperienceService experienceService,
            ExperienceAiService experienceAiService
    ) {
        this.experienceService = experienceService;
        this.experienceAiService = experienceAiService;
    }

    @GetMapping("/templates")
    @PreAuthorize("hasAuthority('content:read')")
    public List<SeasonalExperienceDtos.TemplateDto> listTemplates() {
        return experienceService.listTemplates();
    }

    @GetMapping
    @PreAuthorize("hasAuthority('content:read')")
    public List<SeasonalExperienceDtos.ExperienceSummaryDto> listExperiences(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return experienceService.listExperiences(user.storeId());
    }

    @GetMapping("/settings")
    @PreAuthorize("hasAuthority('content:read')")
    public SeasonalExperienceDtos.ExperienceSettingsDto getSettings(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return experienceService.getSettings(user.storeId());
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAuthority('content:write')")
    public SeasonalExperienceDtos.ExperienceSettingsDto updateSettings(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody SeasonalExperienceDtos.UpdateExperienceSettingsRequest request
    ) {
        return experienceService.updateSettings(user, request);
    }

    @GetMapping("/simulate")
    @PreAuthorize("hasAuthority('content:read')")
    public SeasonalExperienceDtos.ResolvedStorefrontExperienceDto simulate(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) Instant at,
            @RequestParam(required = false) String route
    ) {
        return experienceService.simulate(user.storeId(), at, route);
    }

    @PostMapping("/ai/design")
    @PreAuthorize("hasAuthority('ai:use') and hasAuthority('content:write')")
    public SeasonalExperienceDtos.ExperienceAiDesignResponse aiDesign(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody SeasonalExperienceDtos.ExperienceAiDesignRequest request
    ) {
        return experienceAiService.design(user, request);
    }

    @GetMapping("/{experienceId}")
    @PreAuthorize("hasAuthority('content:read')")
    public SeasonalExperienceDtos.ExperienceDetailDto getExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId
    ) {
        return experienceService.getExperience(user.storeId(), experienceId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('content:write')")
    public SeasonalExperienceDtos.ExperienceDetailDto createExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody SeasonalExperienceDtos.CreateExperienceRequest request
    ) {
        return experienceService.createExperience(user, request);
    }

    @PatchMapping("/{experienceId}")
    @PreAuthorize("hasAuthority('content:write')")
    public SeasonalExperienceDtos.ExperienceDetailDto updateExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId,
            @Valid @RequestBody SeasonalExperienceDtos.UpdateExperienceRequest request
    ) {
        return experienceService.updateExperience(user, experienceId, request);
    }

    @PostMapping("/{experienceId}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('content:write')")
    public SeasonalExperienceDtos.ExperienceDetailDto createVersion(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId,
            @Valid @RequestBody SeasonalExperienceDtos.CreateVersionRequest request
    ) {
        return experienceService.createVersion(user, experienceId, request);
    }

    @PostMapping("/{experienceId}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('content:write')")
    public SeasonalExperienceDtos.ExperienceDetailDto duplicateExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId
    ) {
        return experienceService.duplicateExperience(user, experienceId);
    }

    @DeleteMapping("/{experienceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('content:write')")
    public void deleteExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId
    ) {
        experienceService.deleteExperience(user, experienceId);
    }

    @PostMapping("/{experienceId}/activate")
    @PreAuthorize("hasAuthority('content:publish')")
    public SeasonalExperienceDtos.ExperienceDetailDto activateExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId,
            @RequestBody(required = false) SeasonalExperienceDtos.ActivateExperienceRequest request
    ) {
        return experienceService.activateExperience(user, experienceId, request);
    }

    @PostMapping("/{experienceId}/deactivate")
    @PreAuthorize("hasAuthority('content:publish')")
    public SeasonalExperienceDtos.ExperienceDetailDto deactivateExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId
    ) {
        return experienceService.deactivateExperience(user, experienceId);
    }

    @PostMapping("/{experienceId}/schedule")
    @PreAuthorize("hasAuthority('content:publish')")
    public SeasonalExperienceDtos.ExperienceDetailDto scheduleExperience(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId,
            @Valid @RequestBody SeasonalExperienceDtos.ScheduleExperienceRequest request
    ) {
        return experienceService.scheduleExperience(user, experienceId, request);
    }

    @PostMapping("/{experienceId}/rollback/{versionId}")
    @PreAuthorize("hasAuthority('content:publish')")
    public SeasonalExperienceDtos.ExperienceDetailDto rollbackVersion(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID experienceId,
            @PathVariable UUID versionId
    ) {
        return experienceService.rollbackVersion(user, experienceId, versionId);
    }
}
