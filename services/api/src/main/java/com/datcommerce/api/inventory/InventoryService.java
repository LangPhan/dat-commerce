package com.datcommerce.api.inventory;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {

    private final StockLocationRepository locationRepository;
    private final InventoryItemRepository itemRepository;
    private final InventoryLevelRepository levelRepository;
    private final InventoryReservationRepository reservationRepository;
    private final InventoryAdjustmentRepository adjustmentRepository;
    private final AuditLogService auditLogService;

    public InventoryService(
            StockLocationRepository locationRepository,
            InventoryItemRepository itemRepository,
            InventoryLevelRepository levelRepository,
            InventoryReservationRepository reservationRepository,
            InventoryAdjustmentRepository adjustmentRepository,
            AuditLogService auditLogService
    ) {
        this.locationRepository = locationRepository;
        this.itemRepository = itemRepository;
        this.levelRepository = levelRepository;
        this.reservationRepository = reservationRepository;
        this.adjustmentRepository = adjustmentRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public StockLocationEntity ensureDefaultLocation(UUID storeId) {
        return locationRepository.findFirstByStoreIdAndIsDefaultTrue(storeId)
                .orElseGet(() -> {
                    StockLocationEntity loc = new StockLocationEntity();
                    loc.setId(UUID.randomUUID());
                    loc.setStoreId(storeId);
                    loc.setCode("MAIN");
                    loc.setName("Portland Hub");
                    loc.setAddress("Portland, OR");
                    loc.setDefault(true);
                    loc.setCreatedAt(Instant.now());
                    return locationRepository.save(loc);
                });
    }

    @Transactional
    public InventoryLevelEntity ensureVariantStock(UUID storeId, UUID variantId, String sku, int initialQuantity) {
        if (initialQuantity < 0) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Stock quantity cannot be negative");
        }
        StockLocationEntity loc = ensureDefaultLocation(storeId);
        InventoryItemEntity item = itemRepository.findByVariantId(variantId)
                .orElseGet(() -> {
                    InventoryItemEntity created = new InventoryItemEntity();
                    created.setId(UUID.randomUUID());
                    created.setStoreId(storeId);
                    created.setVariantId(variantId);
                    created.setSku(sku);
                    created.setCreatedAt(Instant.now());
                    return itemRepository.save(created);
                });
        if (!item.getSku().equals(sku)) {
            item.setSku(sku);
            itemRepository.save(item);
        }

        return levelRepository.findByInventoryItemIdAndStockLocationId(item.getId(), loc.getId())
                .orElseGet(() -> {
                    InventoryLevelEntity lvl = new InventoryLevelEntity();
                    lvl.setId(UUID.randomUUID());
                    lvl.setInventoryItemId(item.getId());
                    lvl.setStockLocationId(loc.getId());
                    lvl.setStockedQuantity(initialQuantity);
                    lvl.setReservedQuantity(0);
                    lvl.setUpdatedAt(Instant.now());
                    return levelRepository.save(lvl);
                });
    }

    @Transactional(readOnly = true)
    public Map<UUID, Integer> getAvailableStockByVariantIds(UUID storeId, Collection<UUID> variantIds) {
        if (variantIds == null || variantIds.isEmpty()) {
            return Map.of();
        }
        List<InventoryItemEntity> items = itemRepository.findAllByVariantIdIn(variantIds);
        if (items.isEmpty()) {
            return Map.of();
        }
        List<UUID> itemIds = items.stream().map(InventoryItemEntity::getId).toList();
        List<InventoryLevelEntity> levels = levelRepository.findAllByInventoryItemIdIn(itemIds);
        Map<UUID, Integer> availableByItemId = new HashMap<>();
        for (InventoryLevelEntity level : levels) {
            availableByItemId.merge(level.getInventoryItemId(), level.availableQuantity(), Integer::sum);
        }
        Map<UUID, Integer> result = new HashMap<>();
        for (InventoryItemEntity item : items) {
            result.put(item.getVariantId(), availableByItemId.getOrDefault(item.getId(), 0));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public InventoryOverviewResponse listOverview(UUID storeId) {
        List<StockLocationEntity> locations = locationRepository.findAllByStoreIdOrderByNameAsc(storeId);
        Map<UUID, StockLocationEntity> locById = locations.stream()
                .collect(Collectors.toMap(StockLocationEntity::getId, Function.identity()));

        List<InventoryItemEntity> items = itemRepository.findAllByStoreId(storeId);
        Map<UUID, InventoryItemEntity> itemById = items.stream()
                .collect(Collectors.toMap(InventoryItemEntity::getId, Function.identity()));

        List<InventoryLevelEntity> levels = items.isEmpty()
                ? List.of()
                : levelRepository.findAllByInventoryItemIdIn(itemById.keySet());

        List<InventoryLevelDto> levelDtos = levels.stream()
                .map(lvl -> {
                    InventoryItemEntity item = itemById.get(lvl.getInventoryItemId());
                    StockLocationEntity loc = locById.get(lvl.getStockLocationId());
                    return new InventoryLevelDto(
                            lvl.getId(),
                            item != null ? item.getVariantId() : null,
                            item != null ? item.getSku() : "",
                            loc != null ? loc.getId() : lvl.getStockLocationId(),
                            loc != null ? loc.getName() : "Default",
                            lvl.getStockedQuantity(),
                            lvl.getReservedQuantity(),
                            lvl.availableQuantity(),
                            lvl.getVersion(),
                            lvl.getUpdatedAt()
                    );
                })
                .toList();

        List<AdjustmentDto> adjustments = adjustmentRepository.findTop30ByStoreIdOrderByCreatedAtDesc(storeId).stream()
                .map(a -> new AdjustmentDto(
                        a.getId(),
                        a.getInventoryLevelId(),
                        a.getDelta(),
                        a.getQuantityBefore(),
                        a.getQuantityAfter(),
                        a.getReason(),
                        a.getActorEmail(),
                        a.getCreatedAt()
                ))
                .toList();

        return new InventoryOverviewResponse(
                locations.stream().map(l -> new LocationDto(l.getId(), l.getCode(), l.getName(), l.isDefault())).toList(),
                levelDtos,
                adjustments
        );
    }

    @Transactional
    public InventoryLevelDto adjustStock(AuthenticatedUser actor, AdjustStockRequest req) {
        StockLocationEntity defaultLoc = ensureDefaultLocation(actor.storeId());
        InventoryItemEntity item = itemRepository.findByVariantId(req.variantId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Inventory item not found for variant"));

        UUID locationId = req.stockLocationId() != null ? req.stockLocationId() : defaultLoc.getId();
        InventoryLevelEntity level = levelRepository.findByInventoryItemIdAndStockLocationId(item.getId(), locationId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Inventory level not found for location"));

        int before = level.getStockedQuantity();
        int after = before + req.delta();
        if (after < level.getReservedQuantity()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Stocked quantity cannot drop below reserved quantity or zero");
        }

        Instant now = Instant.now();
        level.setStockedQuantity(after);
        level.setUpdatedAt(now);
        InventoryLevelEntity saved = levelRepository.save(level);

        InventoryAdjustmentEntity adj = new InventoryAdjustmentEntity();
        adj.setId(UUID.randomUUID());
        adj.setStoreId(actor.storeId());
        adj.setInventoryLevelId(saved.getId());
        adj.setDelta(req.delta());
        adj.setQuantityBefore(before);
        adj.setQuantityAfter(after);
        adj.setReason(req.reason().trim());
        adj.setActorUserId(actor.userId());
        adj.setActorEmail(actor.email());
        adj.setCreatedAt(now);
        adjustmentRepository.save(adj);

        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "INVENTORY_ADJUSTED",
                "INVENTORY_LEVEL",
                saved.getId().toString(),
                Map.of("sku", item.getSku(), "stockedQuantity", before),
                Map.of("sku", item.getSku(), "stockedQuantity", after, "delta", req.delta()),
                Map.of("reason", req.reason().trim()),
                null
        );

        StockLocationEntity loc = locationRepository.findById(locationId).orElse(defaultLoc);
        return new InventoryLevelDto(
                saved.getId(),
                item.getVariantId(),
                item.getSku(),
                loc.getId(),
                loc.getName(),
                saved.getStockedQuantity(),
                saved.getReservedQuantity(),
                saved.availableQuantity(),
                saved.getVersion(),
                saved.getUpdatedAt()
        );
    }

    @Transactional
    public void commitOrderStock(UUID storeId, UUID orderId, Map<UUID, Integer> variantQuantities) {
        StockLocationEntity defaultLoc = ensureDefaultLocation(storeId);
        Instant now = Instant.now();

        for (Map.Entry<UUID, Integer> entry : variantQuantities.entrySet()) {
            UUID variantId = entry.getKey();
            int qty = entry.getValue();
            if (qty <= 0) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "Quantity must be positive");
            }
            InventoryItemEntity item = itemRepository.findByVariantId(variantId)
                    .orElseThrow(() -> new ApiException(ErrorCode.CONFLICT, "No inventory record found for variant"));
            InventoryLevelEntity level = levelRepository
                    .findByInventoryItemIdAndStockLocationId(item.getId(), defaultLoc.getId())
                    .orElseThrow(() -> new ApiException(ErrorCode.CONFLICT, "No inventory level for SKU " + item.getSku()));

            if (level.availableQuantity() < qty) {
                throw new ApiException(ErrorCode.CONFLICT, "Insufficient stock for SKU " + item.getSku());
            }

            level.setStockedQuantity(level.getStockedQuantity() - qty);
            level.setUpdatedAt(now);
            levelRepository.save(level);

            InventoryReservationEntity res = new InventoryReservationEntity();
            res.setId(UUID.randomUUID());
            res.setInventoryLevelId(level.getId());
            res.setOrderId(orderId);
            res.setQuantity(qty);
            res.setStatus("COMMITTED");
            res.setCreatedAt(now);
            res.setUpdatedAt(now);
            reservationRepository.save(res);
        }
    }

    @Transactional
    public void releaseOrderStock(UUID orderId) {
        Instant now = Instant.now();
        List<InventoryReservationEntity> reservations = reservationRepository.findAllByOrderId(orderId);
        for (InventoryReservationEntity res : reservations) {
            if (!"COMMITTED".equals(res.getStatus()) && !"ACTIVE".equals(res.getStatus())) {
                continue;
            }
            levelRepository.findById(res.getInventoryLevelId()).ifPresent(level -> {
                if ("COMMITTED".equals(res.getStatus())) {
                    level.setStockedQuantity(level.getStockedQuantity() + res.getQuantity());
                } else {
                    level.setReservedQuantity(Math.max(0, level.getReservedQuantity() - res.getQuantity()));
                }
                level.setUpdatedAt(now);
                levelRepository.save(level);
            });
            res.setStatus("RELEASED");
            res.setUpdatedAt(now);
            reservationRepository.save(res);
        }
    }

    public record AdjustStockRequest(
            @NotNull UUID variantId,
            UUID stockLocationId,
            @NotNull Integer delta,
            @NotBlank @Size(max = 255) String reason
    ) {
    }

    public record LocationDto(UUID id, String code, String name, boolean isDefault) {
    }

    public record InventoryLevelDto(
            UUID id,
            UUID variantId,
            String sku,
            UUID stockLocationId,
            String locationName,
            int stockedQuantity,
            int reservedQuantity,
            int availableQuantity,
            Long version,
            Instant updatedAt
    ) {
    }

    public record AdjustmentDto(
            UUID id,
            UUID inventoryLevelId,
            int delta,
            int quantityBefore,
            int quantityAfter,
            String reason,
            String actorEmail,
            Instant createdAt
    ) {
    }

    public record InventoryOverviewResponse(
            List<LocationDto> locations,
            List<InventoryLevelDto> levels,
            List<AdjustmentDto> recentAdjustments
    ) {
    }
}
