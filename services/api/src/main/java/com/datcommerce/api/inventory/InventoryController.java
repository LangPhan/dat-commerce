package com.datcommerce.api.inventory;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('inventory:read')")
    public InventoryService.InventoryOverviewResponse overview(@AuthenticationPrincipal AuthenticatedUser user) {
        return inventoryService.listOverview(user.storeId());
    }

    @PostMapping("/adjustments")
    @PreAuthorize("hasAuthority('inventory:write')")
    public InventoryService.InventoryLevelDto adjust(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody InventoryService.AdjustStockRequest request
    ) {
        return inventoryService.adjustStock(user, request);
    }
}
