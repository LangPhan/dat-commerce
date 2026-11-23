package com.datcommerce.api.order;

import com.datcommerce.api.cart.StoreCartController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/store")
public class StoreCheckoutController {

    private final OrderService orderService;

    public StoreCheckoutController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderService.OrderDto checkout(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody OrderService.CheckoutRequest request,
            HttpServletRequest servletRequest
    ) {
        String sessionToken = StoreCartController.extractSessionToken(servletRequest);
        return orderService.checkout(sessionToken, idempotencyKey, request);
    }

    @GetMapping("/orders/{orderNumber}")
    public OrderService.OrderDto getOrder(@PathVariable String orderNumber) {
        return orderService.getStoreOrder(orderNumber);
    }
}
