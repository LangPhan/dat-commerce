package com.datcommerce.api.experience;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/store/experiences")
public class SeasonalExperienceStoreController {

    private final SeasonalExperienceService experienceService;

    public SeasonalExperienceStoreController(SeasonalExperienceService experienceService) {
        this.experienceService = experienceService;
    }

    @GetMapping("/active")
    public SeasonalExperienceDtos.ResolvedStorefrontExperienceDto getActive(
            @RequestParam(required = false) String route
    ) {
        return experienceService.getActiveForPublicStore(route);
    }
}
