package com.datcommerce.api.analytics;

import com.datcommerce.api.catalog.CatalogAdminService;
import com.datcommerce.api.catalog.CatalogDtos;
import com.datcommerce.api.catalog.CategoryEntity;
import com.datcommerce.api.catalog.ProductEntity;
import com.datcommerce.api.catalog.ProductRepository;
import com.datcommerce.api.order.OrderEntity;
import com.datcommerce.api.order.OrderItemEntity;
import com.datcommerce.api.order.OrderItemRepository;
import com.datcommerce.api.order.OrderRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("MMM dd").withZone(ZoneOffset.UTC);

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final CatalogAdminService catalogAdminService;

    public AnalyticsService(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            ProductRepository productRepository,
            CatalogAdminService catalogAdminService
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productRepository = productRepository;
        this.catalogAdminService = catalogAdminService;
    }

    @Transactional(readOnly = true)
    public AnalyticsSummaryDto getSummary(UUID storeId) {
        List<OrderEntity> orders = orderRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId).stream()
                .filter(o -> !"CANCELED".equalsIgnoreCase(o.getStatus()))
                .toList();

        BigDecimal totalRevenue = orders.stream()
                .map(OrderEntity::getGrandTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        long orderCount = orders.size();
        BigDecimal aov = orderCount > 0
                ? totalRevenue.divide(BigDecimal.valueOf(orderCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        List<UUID> orderIds = orders.stream().map(OrderEntity::getId).toList();
        List<OrderItemEntity> allOrderItems = orderIds.isEmpty()
                ? List.of()
                : orderItemRepository.findAllByOrderIdIn(orderIds);

        List<ProductEntity> products = productRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId);
        Map<UUID, ProductEntity> productById = products.stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        List<CatalogDtos.ProductDto> assembled = catalogAdminService.assembleProducts(storeId, products);

        // Revenue by category
        Map<String, BigDecimal> categoryRev = new HashMap<>();
        Map<UUID, Integer> soldByProduct = new HashMap<>();
        Map<UUID, BigDecimal> revByProduct = new HashMap<>();

        for (OrderItemEntity item : allOrderItems) {
            soldByProduct.merge(item.getProductId(), item.getQuantity(), Integer::sum);
            revByProduct.merge(item.getProductId(), item.getLineTotal(), BigDecimal::add);

            ProductEntity p = productById.get(item.getProductId());
            String primaryCat = (p != null && !p.getCategories().isEmpty())
                    ? p.getCategories().stream().map(CategoryEntity::getName).sorted().findFirst().orElse("General")
                    : "General";
            categoryRev.merge(primaryCat, item.getLineTotal(), BigDecimal::add);
        }

        List<CategoryBreakdownDto> categoryBreakdown = categoryRev.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(e -> {
                    int share = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                            ? e.getValue().multiply(BigDecimal.valueOf(100))
                                    .divide(totalRevenue, 0, RoundingMode.HALF_UP).intValue()
                            : 0;
                    return new CategoryBreakdownDto(e.getKey(), share, e.getValue().setScale(2, RoundingMode.HALF_UP));
                })
                .toList();

        // Low stock variants (available <= 5)
        List<LowStockDto> lowStock = assembled.stream()
                .flatMap(p -> p.variants().stream()
                        .filter(v -> v.availableStock() <= 5)
                        .map(v -> new LowStockDto(
                                p.id(), v.id(), p.name(), v.sku(), p.primaryImageUrl(), v.availableStock())))
                .sorted(Comparator.comparingInt(LowStockDto::availableStock))
                .toList();

        // Top products
        List<TopProductDto> topProducts = assembled.stream()
                .map(p -> new TopProductDto(
                        p.id(), p.name(), p.primaryImageUrl(), p.minPrice(),
                        soldByProduct.getOrDefault(p.id(), 0),
                        revByProduct.getOrDefault(p.id(), BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP)))
                .sorted(Comparator.comparing(TopProductDto::revenue).reversed()
                        .thenComparing(TopProductDto::unitsSold, Comparator.reverseOrder()))
                .limit(5)
                .toList();

        // Revenue trajectory by day
        Map<String, DailyPoint> byDay = new LinkedHashMap<>();
        orders.stream()
                .sorted(Comparator.comparing(OrderEntity::getCreatedAt))
                .forEach(o -> {
                    String label = DAY_FMT.format(o.getCreatedAt());
                    byDay.compute(label, (k, existing) -> existing == null
                            ? new DailyPoint(label, o.getGrandTotal(), 1)
                            : new DailyPoint(label, existing.amount().add(o.getGrandTotal()), existing.orders() + 1));
                });

        return new AnalyticsSummaryDto(
                totalRevenue,
                orderCount,
                aov,
                products.size(),
                lowStock.size(),
                List.copyOf(byDay.values()),
                categoryBreakdown,
                topProducts,
                lowStock
        );
    }

    public record DailyPoint(String label, BigDecimal amount, int orders) {
    }

    public record CategoryBreakdownDto(String category, int share, BigDecimal revenue) {
    }

    public record TopProductDto(
            UUID productId,
            String name,
            String imageUrl,
            BigDecimal price,
            int unitsSold,
            BigDecimal revenue
    ) {
    }

    public record LowStockDto(
            UUID productId,
            UUID variantId,
            String productName,
            String sku,
            String imageUrl,
            int availableStock
    ) {
    }

    public record AnalyticsSummaryDto(
            BigDecimal totalRevenue,
            long totalOrders,
            BigDecimal averageOrderValue,
            int productCount,
            int lowStockCount,
            List<DailyPoint> revenueSeries,
            List<CategoryBreakdownDto> categoryBreakdown,
            List<TopProductDto> topProducts,
            List<LowStockDto> lowStockItems
    ) {
    }
}
