package com.datcommerce.api.cms;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class CmsAdminController {

    private final CmsService cmsService;

    public CmsAdminController(CmsService cmsService) {
        this.cmsService = cmsService;
    }

    @GetMapping("/pages")
    @PreAuthorize("hasAuthority('content:read')")
    public List<CmsService.PageSummaryDto> listPages(@AuthenticationPrincipal AuthenticatedUser user) {
        return cmsService.listPages(user.storeId());
    }

    @GetMapping("/pages/{pageId}")
    @PreAuthorize("hasAuthority('content:read')")
    public CmsService.PageDetailDto getPage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId
    ) {
        return cmsService.getAdminPage(user.storeId(), pageId);
    }

    @PostMapping("/pages")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('content:write')")
    public CmsService.PageDetailDto createPage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CmsService.CreatePageRequest request
    ) {
        return cmsService.createPage(user, request);
    }

    @PostMapping("/pages/{pageId}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('content:write')")
    public CmsService.PageDetailDto createPageVersion(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId,
            @Valid @RequestBody CmsService.CreatePageVersionRequest request
    ) {
        return cmsService.createPageVersion(user, pageId, request);
    }

    @PostMapping("/pages/{pageId}/preview")
    @PreAuthorize("hasAuthority('content:read')")
    public CmsService.PageVersionDto previewPage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId
    ) {
        return cmsService.previewPage(user.storeId(), pageId);
    }

    @PostMapping("/pages/{pageId}/publish")
    @PreAuthorize("hasAuthority('content:publish')")
    public CmsService.PageDetailDto publishPage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId,
            @RequestBody(required = false) CmsService.PublishPageRequest request
    ) {
        return cmsService.publishPage(user, pageId, request);
    }

    @GetMapping("/pages/{pageId}/versions")
    @PreAuthorize("hasAuthority('content:read')")
    public List<CmsService.PageVersionDto> listPageVersions(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId
    ) {
        return cmsService.getAdminPage(user.storeId(), pageId).versions();
    }

    @PostMapping("/pages/{pageId}/rollback/{versionId}")
    @PreAuthorize("hasAuthority('content:publish')")
    public CmsService.PageDetailDto rollbackPage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID pageId,
            @PathVariable UUID versionId
    ) {
        return cmsService.rollbackPage(user, pageId, versionId);
    }

    @GetMapping("/theme")
    @PreAuthorize("hasAuthority('content:read')")
    public CmsService.AdminThemeResponse getTheme(@AuthenticationPrincipal AuthenticatedUser user) {
        return cmsService.getAdminTheme(user.storeId());
    }

    @PostMapping("/theme/versions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('content:write')")
    public CmsService.ThemeVersionDto createThemeVersion(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CmsService.CreateThemeVersionRequest request
    ) {
        return cmsService.createThemeVersion(user, request);
    }

    @PostMapping("/theme/publish")
    @PreAuthorize("hasAuthority('content:publish')")
    public CmsService.ThemeVersionDto publishTheme(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody(required = false) CmsService.PublishThemeRequest request
    ) {
        return cmsService.publishTheme(user, request == null ? null : request.versionId());
    }

    @PostMapping("/theme/rollback/{versionId}")
    @PreAuthorize("hasAuthority('content:publish')")
    public CmsService.ThemeVersionDto rollbackTheme(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID versionId
    ) {
        return cmsService.rollbackTheme(user, versionId);
    }

    @GetMapping("/navigation/{menuKey}")
    @PreAuthorize("hasAuthority('content:read')")
    public CmsService.NavigationMenuDto getNavigation(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String menuKey
    ) {
        return cmsService.getAdminNavigation(user.storeId(), menuKey);
    }

    @PutMapping("/navigation/{menuKey}")
    @PreAuthorize("hasAuthority('content:write')")
    public CmsService.NavigationMenuDto updateNavigation(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String menuKey,
            @Valid @RequestBody CmsService.UpdateNavigationRequest request
    ) {
        return cmsService.updateNavigation(user, menuKey, request.items());
    }
}
