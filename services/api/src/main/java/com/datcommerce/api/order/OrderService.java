package com.datcommerce.api.order;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.cart.CartEntity;
import com.datcommerce.api.cart.CartItemRepository;
import com.datcommerce.api.cart.CartRepository;
import com.datcommerce.api.cart.CartService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.inventory.InventoryService;
import com.datcommerce.api.payment.PaymentEntity;
import com.datcommerce.api.payment.PaymentGateway;
import com.datcommerce.api.payment.PaymentRepository;
import com.datcommerce.api.pricing.PricingCalculationService;
import com.datcommerce.api.promotion.PromotionRepository;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class OrderService {

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            "CONFIRMED", Set.of("PROCESSING", "SHIPPED"),
            "PROCESSING", Set.of("SHIPPED"),
            "SHIPPED", Set.of("DELIVERED"),
            "DELIVERED", Set.of(),
            "CANCELED", Set.of()
    );

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderAddressRepository orderAddressRepository;
    private final OrderEventRepository orderEventRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentGateway paymentGateway;
    private final CartService cartService;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final PricingCalculationService pricingCalculationService;
    private final InventoryService inventoryService;
    private final PromotionRepository promotionRepository;
    private final AuditLogService auditLogService;
    private final MeterRegistry meterRegistry;

    public OrderService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderAddressRepository orderAddressRepository,
            OrderEventRepository orderEventRepository,
            PaymentRepository paymentRepository,
            PaymentGateway paymentGateway,
            CartService cartService,
            CartRepository cartRepository,
            CartItemRepository cartItemRepository,
            PricingCalculationService pricingCalculationService,
            InventoryService inventoryService,
            PromotionRepository promotionRepository,
            AuditLogService auditLogService,
            MeterRegistry meterRegistry
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.orderAddressRepository = orderAddressRepository;
        this.orderEventRepository = orderEventRepository;
        this.paymentRepository = paymentRepository;
        this.paymentGateway = paymentGateway;
        this.cartService = cartService;
        this.cartRepository = cartRepository;
        this.cartItemRepository = cartItemRepository;
        this.pricingCalculationService = pricingCalculationService;
        this.inventoryService = inventoryService;
        this.promotionRepository = promotionRepository;
        this.auditLogService = auditLogService;
        this.meterRegistry = meterRegistry;
    }

    @Transactional
    public OrderDto checkout(String sessionToken, String idempotencyKey, CheckoutRequest req) {
        if (StringUtils.hasText(idempotencyKey)) {
            var existing = orderRepository.findByIdempotencyKey(idempotencyKey.trim());
            if (existing.isPresent()) {
                return assembleOrders(List.of(existing.get())).getFirst();
            }
        }

        try {
            return executeCheckout(sessionToken, idempotencyKey, req);
        } catch (RuntimeException ex) {
            meterRegistry.counter("datcommerce.orders.checkout.total", "status", "failed").increment();
            throw ex;
        }
    }

    private OrderDto executeCheckout(String sessionToken, String idempotencyKey, CheckoutRequest req) {

        CartEntity cart = cartService.resolveCartEntity(sessionToken);
        List<PricingCalculationService.PricedLineInput> cartLines = cartService.loadPricedLines(cart.getId());
        if (cartLines.isEmpty()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Your cart is empty");
        }

        String promoCode = StringUtils.hasText(req.promotionCode()) ? req.promotionCode().trim() : cart.getPromotionCode();
        var quote = pricingCalculationService.calculateQuote(
                cart.getStoreId(),
                cart.getCurrency(),
                cartLines,
                promoCode,
                req.shippingMethod(),
                StringUtils.hasText(req.promotionCode())
        );

        UUID orderId = UUID.randomUUID();
        String orderNumber = "TR-" + orderId.toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);

        Map<UUID, Integer> qtyByVariant = new LinkedHashMap<>();
        for (PricingCalculationService.QuotedLine line : quote.lines()) {
            qtyByVariant.merge(line.variantId(), line.quantity(), Integer::sum);
        }
        inventoryService.commitOrderStock(cart.getStoreId(), orderId, qtyByVariant);

        var charge = paymentGateway.authorizeAndCapture(orderId, quote.grandTotal(), quote.currency(), req.paymentToken());
        if (!charge.success()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, charge.failureReason());
        }

        Instant now = Instant.now();
        OrderEntity order = new OrderEntity();
        order.setId(orderId);
        order.setStoreId(cart.getStoreId());
        order.setOrderNumber(orderNumber);
        order.setCustomerName(req.customerName().trim());
        order.setCustomerEmail(req.customerEmail().trim().toLowerCase(Locale.ROOT));
        order.setStatus("CONFIRMED");
        order.setPaymentStatus("PAID");
        order.setFulfillmentStatus("UNFULFILLED");
        order.setCurrency(quote.currency());
        order.setSubtotal(quote.subtotal());
        order.setDiscountTotal(quote.discountTotal());
        order.setShippingTotal(quote.shippingTotal());
        order.setTaxTotal(quote.taxTotal());
        order.setGrandTotal(quote.grandTotal());
        order.setPromotionCode(quote.promotionCode());
        order.setTrackingNumber("");
        order.setIdempotencyKey(StringUtils.hasText(idempotencyKey) ? idempotencyKey.trim() : null);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        OrderEntity savedOrder = orderRepository.save(order);

        List<OrderItemEntity> orderItems = quote.lines().stream().map(q -> {
            OrderItemEntity item = new OrderItemEntity();
            item.setId(UUID.randomUUID());
            item.setOrderId(orderId);
            item.setProductId(q.productId());
            item.setVariantId(q.variantId());
            item.setProductName(q.productName());
            item.setVariantTitle(q.variantTitle());
            item.setSku(q.sku());
            item.setUnitPrice(q.unitPrice());
            item.setQuantity(q.quantity());
            item.setLineTotal(q.lineTotal());
            return item;
        }).toList();
        orderItemRepository.saveAll(orderItems);

        OrderAddressEntity addr = new OrderAddressEntity();
        addr.setId(UUID.randomUUID());
        addr.setOrderId(orderId);
        addr.setKind("SHIPPING");
        addr.setFullName(req.customerName().trim());
        addr.setLine1(req.address().line1().trim());
        addr.setCity(req.address().city().trim());
        addr.setState(req.address().state());
        addr.setPostalCode(req.address().postalCode().trim());
        addr.setCountry(StringUtils.hasText(req.address().country()) ? req.address().country().trim() : "US");
        orderAddressRepository.save(addr);

        PaymentEntity payment = new PaymentEntity();
        payment.setId(UUID.randomUUID());
        payment.setOrderId(orderId);
        payment.setProvider(charge.provider());
        payment.setStatus("CAPTURED");
        payment.setAmount(quote.grandTotal());
        payment.setCurrency(quote.currency());
        payment.setExternalRef(charge.externalRef());
        payment.setCreatedAt(now);
        paymentRepository.save(payment);

        saveEvent(orderId, "placed", "Order placed",
                quote.promotionCode() != null ? "Applied promo " + quote.promotionCode() : "Storefront checkout", now);
        saveEvent(orderId, "payment", "Payment captured",
                quote.currency() + " " + quote.grandTotal() + " settled via " + charge.provider(), now.plusMillis(1));

        if (quote.promotionId() != null) {
            promotionRepository.findById(quote.promotionId()).ifPresent(p -> {
                p.setUsedCount(p.getUsedCount() + 1);
                p.setUpdatedAt(now);
                promotionRepository.save(p);
            });
        }

        cartItemRepository.deleteAllByCartId(cart.getId());
        cart.setPromotionCode(null);
        cart.setUpdatedAt(now);
        cartRepository.save(cart);

        meterRegistry.counter("datcommerce.orders.checkout.total", "status", "confirmed").increment();
        return assembleOrders(List.of(savedOrder)).getFirst();
    }

    @Transactional(readOnly = true)
    public OrderDto getStoreOrder(String orderNumber) {
        OrderEntity order = orderRepository.findByOrderNumberIgnoreCase(orderNumber.trim())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Order not found"));
        return assembleOrders(List.of(order)).getFirst();
    }

    @Transactional(readOnly = true)
    public List<OrderDto> listAdminOrders(UUID storeId, String status) {
        List<OrderEntity> orders = orderRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId).stream()
                .filter(o -> !StringUtils.hasText(status) || o.getStatus().equalsIgnoreCase(status.trim()))
                .toList();
        return assembleOrders(orders);
    }

    @Transactional(readOnly = true)
    public OrderDto getAdminOrder(UUID storeId, UUID orderId) {
        OrderEntity order = orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Order not found"));
        return assembleOrders(List.of(order)).getFirst();
    }

    @Transactional
    public OrderDto updateOrderStatus(AuthenticatedUser actor, UUID orderId, UpdateOrderStatusRequest req) {
        OrderEntity order = orderRepository.findByIdAndStoreId(orderId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Order not found"));

        String current = order.getStatus().toUpperCase(Locale.ROOT);
        String next = req.status().trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_TRANSITIONS.containsKey(current) || !ALLOWED_TRANSITIONS.get(current).contains(next)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Invalid order status transition from " + current + " to " + next);
        }

        String beforeStatus = order.getStatus();
        order.setStatus(next);
        order.setFulfillmentStatus(switch (next) {
            case "PROCESSING" -> "PROCESSING";
            case "SHIPPED" -> "SHIPPED";
            case "DELIVERED" -> "DELIVERED";
            default -> order.getFulfillmentStatus();
        });
        if (req.trackingNumber() != null) {
            order.setTrackingNumber(req.trackingNumber().trim());
        }
        Instant now = Instant.now();
        order.setUpdatedAt(now);
        OrderEntity saved = orderRepository.save(order);

        String detail = StringUtils.hasText(saved.getTrackingNumber())
                ? "Status changed to " + next + " · Tracking: " + saved.getTrackingNumber()
                : "Status changed to " + next;
        saveEvent(orderId, "fulfillment", "Fulfillment updated", detail, now);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ORDER_STATUS_UPDATED", "ORDER", saved.getId().toString(),
                Map.of("status", beforeStatus),
                Map.of("status", saved.getStatus(), "trackingNumber", saved.getTrackingNumber() == null ? "" : saved.getTrackingNumber()),
                Map.of("orderNumber", saved.getOrderNumber()), null
        );
        return assembleOrders(List.of(saved)).getFirst();
    }

    @Transactional
    public OrderDto cancelOrder(AuthenticatedUser actor, UUID orderId, CancelOrderRequest req) {
        OrderEntity order = orderRepository.findByIdAndStoreId(orderId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Order not found"));

        String current = order.getStatus().toUpperCase(Locale.ROOT);
        if ("DELIVERED".equals(current) || "CANCELED".equals(current)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Cannot cancel an order in status " + current);
        }

        inventoryService.releaseOrderStock(order.getId());

        Instant now = Instant.now();
        String beforeStatus = order.getStatus();
        order.setStatus("CANCELED");
        order.setFulfillmentStatus("CANCELED");
        order.setPaymentStatus("REFUNDED");
        order.setUpdatedAt(now);
        OrderEntity saved = orderRepository.save(order);

        String reason = req != null && StringUtils.hasText(req.reason()) ? req.reason().trim() : "Canceled by merchant";
        saveEvent(orderId, "note", "Order canceled", reason + " (inventory restored)", now);

        auditLogService.record(
                actor.storeId(), actor.userId(), actor.email(),
                "ORDER_CANCELED", "ORDER", saved.getId().toString(),
                Map.of("status", beforeStatus, "paymentStatus", "PAID"),
                Map.of("status", "CANCELED", "paymentStatus", "REFUNDED"),
                Map.of("orderNumber", saved.getOrderNumber(), "reason", reason), null
        );
        meterRegistry.counter("datcommerce.orders.canceled.total").increment();
        return assembleOrders(List.of(saved)).getFirst();
    }

    private void saveEvent(UUID orderId, String kind, String label, String detail, Instant at) {
        OrderEventEntity ev = new OrderEventEntity();
        ev.setId(UUID.randomUUID());
        ev.setOrderId(orderId);
        ev.setKind(kind);
        ev.setLabel(label);
        ev.setDetail(detail);
        ev.setCreatedAt(at);
        orderEventRepository.save(ev);
    }

    private List<OrderDto> assembleOrders(List<OrderEntity> orders) {
        if (orders.isEmpty()) return List.of();
        List<UUID> ids = orders.stream().map(OrderEntity::getId).toList();
        Map<UUID, List<OrderItemEntity>> itemsByOrder = orderItemRepository.findAllByOrderIdIn(ids).stream()
                .collect(Collectors.groupingBy(OrderItemEntity::getOrderId));
        Map<UUID, List<OrderAddressEntity>> addrsByOrder = orderAddressRepository.findAllByOrderIdIn(ids).stream()
                .collect(Collectors.groupingBy(OrderAddressEntity::getOrderId));
        Map<UUID, List<OrderEventEntity>> eventsByOrder = orderEventRepository.findAllByOrderIdInOrderByCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(OrderEventEntity::getOrderId));

        return orders.stream().map(o -> {
            List<OrderItemDto> items = itemsByOrder.getOrDefault(o.getId(), List.of()).stream()
                    .map(i -> new OrderItemDto(
                            i.getId(), i.getProductId(), i.getVariantId(),
                            i.getProductName(), i.getVariantTitle(), i.getSku(),
                            i.getUnitPrice(), i.getQuantity(), i.getLineTotal()))
                    .toList();
            OrderAddressEntity ship = addrsByOrder.getOrDefault(o.getId(), List.of()).stream().findFirst().orElse(null);
            AddressDto shipDto = ship == null ? null : new AddressDto(
                    ship.getFullName(), ship.getLine1(), ship.getCity(), ship.getState(), ship.getPostalCode(), ship.getCountry());
            List<OrderEventDto> events = eventsByOrder.getOrDefault(o.getId(), List.of()).stream()
                    .map(e -> new OrderEventDto(e.getKind(), e.getLabel(), e.getDetail(), e.getCreatedAt()))
                    .toList();

            return new OrderDto(
                    o.getId(), o.getOrderNumber(), o.getCustomerName(), o.getCustomerEmail(),
                    o.getStatus(), o.getPaymentStatus(), o.getFulfillmentStatus(),
                    o.getCurrency(), o.getSubtotal(), o.getDiscountTotal(),
                    o.getShippingTotal(), o.getTaxTotal(), o.getGrandTotal(),
                    o.getPromotionCode(), o.getTrackingNumber(), o.getVersion(),
                    o.getCreatedAt(), items, shipDto, events
            );
        }).toList();
    }

    public record AddressInput(
            @NotBlank @Size(max = 255) String line1,
            @NotBlank @Size(max = 120) String city,
            @Size(max = 120) String state,
            @NotBlank @Size(max = 32) String postalCode,
            @Size(max = 64) String country
    ) {
    }

    public record CheckoutRequest(
            @NotBlank @Size(max = 160) String customerName,
            @NotBlank @Email @Size(max = 255) String customerEmail,
            @NotNull @Valid AddressInput address,
            String shippingMethod,
            String promotionCode,
            String paymentToken
    ) {
    }

    public record UpdateOrderStatusRequest(
            @NotBlank String status,
            @Size(max = 128) String trackingNumber
    ) {
    }

    public record CancelOrderRequest(@Size(max = 255) String reason) {
    }

    public record OrderItemDto(
            UUID id,
            UUID productId,
            UUID variantId,
            String productName,
            String variantTitle,
            String sku,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal
    ) {
    }

    public record AddressDto(
            String fullName,
            String line1,
            String city,
            String state,
            String postalCode,
            String country
    ) {
    }

    public record OrderEventDto(String kind, String label, String detail, Instant createdAt) {
    }

    public record OrderDto(
            UUID id,
            String orderNumber,
            String customerName,
            String customerEmail,
            String status,
            String paymentStatus,
            String fulfillmentStatus,
            String currency,
            BigDecimal subtotal,
            BigDecimal discountTotal,
            BigDecimal shippingTotal,
            BigDecimal taxTotal,
            BigDecimal grandTotal,
            String promotionCode,
            String trackingNumber,
            Long version,
            Instant createdAt,
            List<OrderItemDto> items,
            AddressDto shippingAddress,
            List<OrderEventDto> events
    ) {
    }
}
