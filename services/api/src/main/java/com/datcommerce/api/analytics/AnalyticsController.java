package com.datcommerce.api.analytics;

import com.datcommerce.api.common.security.AuthenticatedUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('dashboard:read')")
    public AnalyticsService.AnalyticsSummaryDto summary(@AuthenticationPrincipal AuthenticatedUser user) {
        return analyticsService.getSummary(user.storeId());
    }
}
