package com.datcommerce.api.order;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/orders")
public class OrderAdminController {

    private final OrderService orderService;

    public OrderAdminController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('order:read')")
    public List<OrderService.OrderDto> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) String status
    ) {
        return orderService.listAdminOrders(user.storeId(), status);
    }

    @GetMapping("/{orderId}")
    @PreAuthorize("hasAuthority('order:read')")
    public OrderService.OrderDto get(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID orderId
    ) {
        return orderService.getAdminOrder(user.storeId(), orderId);
    }

    @PatchMapping("/{orderId}/status")
    @PreAuthorize("hasAuthority('order:write')")
    public OrderService.OrderDto updateStatus(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID orderId,
            @Valid @RequestBody OrderService.UpdateOrderStatusRequest request
    ) {
        return orderService.updateOrderStatus(user, orderId, request);
    }

    @PostMapping("/{orderId}/cancel")
    @PreAuthorize("hasAuthority('order:cancel')")
    public OrderService.OrderDto cancel(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID orderId,
            @Valid @RequestBody(required = false) OrderService.CancelOrderRequest request
    ) {
        return orderService.cancelOrder(user, orderId, request);
    }
}
