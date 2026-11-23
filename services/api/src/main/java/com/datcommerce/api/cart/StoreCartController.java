package com.datcommerce.api.cart;

import com.datcommerce.api.common.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/store/cart")
public class StoreCartController {

    public static final String CART_COOKIE = "dc_cart_session";
    public static final String CART_HEADER = "X-Cart-Session";

    private final CartService cartService;
    private final AppProperties appProperties;

    public StoreCartController(CartService cartService, AppProperties appProperties) {
        this.cartService = cartService;
        this.appProperties = appProperties;
    }

    @GetMapping
    public ResponseEntity<CartService.CartResponse> getCart(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartService.CartResponse cart = cartService.getOrCreateCart(extractSessionToken(request));
        writeSessionCookie(response, cart.sessionToken());
        return ResponseEntity.ok(cart);
    }

    @PostMapping("/items")
    public ResponseEntity<CartService.CartResponse> addItem(
            @Valid @RequestBody CartService.AddCartItemRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartService.CartResponse cart = cartService.addItem(extractSessionToken(request), body);
        writeSessionCookie(response, cart.sessionToken());
        return ResponseEntity.ok(cart);
    }

    @PatchMapping("/items/{variantId}")
    public ResponseEntity<CartService.CartResponse> updateItem(
            @PathVariable UUID variantId,
            @Valid @RequestBody CartService.UpdateCartItemRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartService.CartResponse cart = cartService.updateItemQuantity(
                extractSessionToken(request), variantId, body.quantity()
        );
        writeSessionCookie(response, cart.sessionToken());
        return ResponseEntity.ok(cart);
    }

    @DeleteMapping("/items/{variantId}")
    public ResponseEntity<CartService.CartResponse> removeItem(
            @PathVariable UUID variantId,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartService.CartResponse cart = cartService.removeItem(extractSessionToken(request), variantId);
        writeSessionCookie(response, cart.sessionToken());
        return ResponseEntity.ok(cart);
    }

    @PostMapping("/promotion")
    public ResponseEntity<CartService.CartResponse> applyPromotion(
            @RequestBody CartService.ApplyPromoRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        CartService.CartResponse cart = cartService.applyPromotion(
                extractSessionToken(request), body == null ? null : body.code()
        );
        writeSessionCookie(response, cart.sessionToken());
        return ResponseEntity.ok(cart);
    }

    public static String extractSessionToken(HttpServletRequest request) {
        String header = request.getHeader(CART_HEADER);
        if (StringUtils.hasText(header)) {
            return header.trim();
        }
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (CART_COOKIE.equals(c.getName()) && StringUtils.hasText(c.getValue())) {
                    return c.getValue().trim();
                }
            }
        }
        return null;
    }

    private void writeSessionCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from(CART_COOKIE, token)
                .httpOnly(true)
                .secure(appProperties.getCookie().isSecure())
                .sameSite(appProperties.getCookie().getSameSite())
                .path("/api/v1/store")
                .maxAge(60L * 60 * 24 * 30)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
