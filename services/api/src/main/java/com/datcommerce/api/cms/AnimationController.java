package com.datcommerce.api.cms;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AnimationController {

    private final AnimationPresetService animationPresetService;

    public AnimationController(AnimationPresetService animationPresetService) {
        this.animationPresetService = animationPresetService;
    }

    // ---- Animation Presets ----

    @GetMapping("/animation-presets")
    @PreAuthorize("hasAuthority('content:read')")
    public List<AnimationPresetService.AnimationPresetDto> listPresets(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) String category
    ) {
        return animationPresetService.listAdminPresets(user.storeId(), category);
    }

    @PostMapping("/animation-presets")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('content:write')")
    public AnimationPresetService.AnimationPresetDto createPreset(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody AnimationPresetService.CreateAnimationPresetRequest request
    ) {
        return animationPresetService.createPreset(user, request);
    }

    @GetMapping("/animation-presets/{presetId}")
    @PreAuthorize("hasAuthority('content:read')")
    public AnimationPresetService.AnimationPresetDto getPreset(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID presetId
    ) {
        return animationPresetService.getPreset(user.storeId(), presetId);
    }

    @PutMapping("/animation-presets/{presetId}")
    @PreAuthorize("hasAuthority('content:write')")
    public AnimationPresetService.AnimationPresetDto updatePreset(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID presetId,
            @Valid @RequestBody AnimationPresetService.UpdateAnimationPresetRequest request
    ) {
        return animationPresetService.updatePreset(user, presetId, request);
    }

    @DeleteMapping("/animation-presets/{presetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('content:write')")
    public void deletePreset(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID presetId
    ) {
        animationPresetService.deletePreset(user, presetId);
    }

    // ---- Element Animations on Page Draft ----

    @GetMapping("/pages/{pageId}/animations")
    @PreAuthorize("hasAuthority('content:read')")
    public AnimationPresetService.PageAnimationsResponse getPageAnimations(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId
    ) {
        return animationPresetService.getPageAnimations(user.storeId(), pageId);
    }

    @PutMapping("/pages/{pageId}/elements/{elementId}/animation")
    @PreAuthorize("hasAuthority('content:write')")
    public CmsService.PageDetailDto putElementAnimation(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId,
            @PathVariable String elementId,
            @Valid @RequestBody AnimationPresetService.UpdateElementAnimationRequest request
    ) {
        return animationPresetService.upsertElementAnimation(user, pageId, elementId, request);
    }

    @DeleteMapping("/pages/{pageId}/elements/{elementId}/animation")
    @PreAuthorize("hasAuthority('content:write')")
    public CmsService.PageDetailDto deleteElementAnimation(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId,
            @PathVariable String elementId,
            @RequestParam(required = false) Long expectedVersion
    ) {
        return animationPresetService.deleteElementAnimation(user, pageId, elementId, expectedVersion);
    }

    // ---- Global Motion Settings ----

    @GetMapping("/theme/motion-settings")
    @PreAuthorize("hasAuthority('content:read')")
    public AnimationPresetService.GlobalMotionResponse getGlobalMotionSettings(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return animationPresetService.getGlobalMotionSettings(user.storeId());
    }

    @PutMapping("/theme/motion-settings")
    @PreAuthorize("hasAuthority('content:write')")
    public CmsService.ThemeVersionDto updateGlobalMotionSettings(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody AnimationPresetService.UpdateGlobalMotionRequest request
    ) {
        return animationPresetService.updateGlobalMotionSettings(user, request);
    }
}
