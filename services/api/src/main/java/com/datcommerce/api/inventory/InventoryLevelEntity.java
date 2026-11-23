package com.datcommerce.api.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "inventory_levels")
public class InventoryLevelEntity {

    @Id
    private UUID id;

    @Column(name = "inventory_item_id", nullable = false)
    private UUID inventoryItemId;

    @Column(name = "stock_location_id", nullable = false)
    private UUID stockLocationId;

    @Column(name = "stocked_quantity", nullable = false)
    private Integer stockedQuantity;

    @Column(name = "reserved_quantity", nullable = false)
    private Integer reservedQuantity;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public int availableQuantity() {
        return Math.max(0, (stockedQuantity == null ? 0 : stockedQuantity) - (reservedQuantity == null ? 0 : reservedQuantity));
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getInventoryItemId() {
        return inventoryItemId;
    }

    public void setInventoryItemId(UUID inventoryItemId) {
        this.inventoryItemId = inventoryItemId;
    }

    public UUID getStockLocationId() {
        return stockLocationId;
    }

    public void setStockLocationId(UUID stockLocationId) {
        this.stockLocationId = stockLocationId;
    }

    public Integer getStockedQuantity() {
        return stockedQuantity;
    }

    public void setStockedQuantity(Integer stockedQuantity) {
        this.stockedQuantity = stockedQuantity;
    }

    public Integer getReservedQuantity() {
        return reservedQuantity;
    }

    public void setReservedQuantity(Integer reservedQuantity) {
        this.reservedQuantity = reservedQuantity;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
