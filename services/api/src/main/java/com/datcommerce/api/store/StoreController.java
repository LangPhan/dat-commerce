package com.datcommerce.api.store;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/store")
public class StoreController {

    private final StoreService storeService;

    public StoreController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('store:read')")
    public StoreService.StoreResponse getStore(@AuthenticationPrincipal AuthenticatedUser user) {
        return storeService.getStore(user.storeId());
    }

    @PatchMapping
    @PreAuthorize("hasAuthority('store:write')")
    public StoreService.StoreResponse updateStore(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody StoreService.UpdateStoreRequest request
    ) {
        return storeService.updateStore(user, request);
    }
}
