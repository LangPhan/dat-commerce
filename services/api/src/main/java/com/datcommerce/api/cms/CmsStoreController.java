package com.datcommerce.api.cms;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/store")
public class CmsStoreController {

    private final CmsService cmsService;
    private final AnimationPresetService animationPresetService;

    public CmsStoreController(CmsService cmsService, AnimationPresetService animationPresetService) {
        this.cmsService = cmsService;
        this.animationPresetService = animationPresetService;
    }

    @GetMapping("/pages/{slug}")
    public CmsService.StorePageResponse getPage(@PathVariable String slug) {
        return cmsService.getPublishedPage(slug);
    }

    @GetMapping("/theme")
    public CmsService.ThemeVersionDto getTheme() {
        return cmsService.getPublishedTheme();
    }

    @GetMapping("/navigation/{menuKey}")
    public CmsService.NavigationMenuDto getNavigation(@PathVariable String menuKey) {
        return cmsService.getStoreNavigation(menuKey);
    }

    @GetMapping("/animation-presets")
    public List<AnimationPresetService.AnimationPresetDto> listAnimationPresets() {
        return animationPresetService.listStorePresets();
    }
}
