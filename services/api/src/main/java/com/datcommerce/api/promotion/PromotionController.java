package com.datcommerce.api.promotion;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/promotions")
public class PromotionController {

    private final PromotionService promotionService;

    public PromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('promotion:read')")
    public List<PromotionService.PromotionDto> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return promotionService.list(user.storeId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('promotion:write')")
    public PromotionService.PromotionDto create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody PromotionService.CreatePromotionRequest request
    ) {
        return promotionService.create(user, request);
    }

    @PatchMapping("/{promotionId}")
    @PreAuthorize("hasAuthority('promotion:write')")
    public PromotionService.PromotionDto update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID promotionId,
            @Valid @RequestBody PromotionService.UpdatePromotionRequest request
    ) {
        return promotionService.update(user, promotionId, request);
    }
}
