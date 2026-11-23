package com.datcommerce.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "collections")
public class CollectionEntity {

    @Id
    private UUID id;

    @Column(name = "store_id", nullable = false)
    private UUID storeId;

    @Column(nullable = false, length = 160)
    private String slug;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getStoreId() {
        return storeId;
    }

    public void setStoreId(UUID storeId) {
        this.storeId = storeId;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Entity
    @Table(name = "collection_products")
    public static class CollectionProductEntity {

        @EmbeddedId
        private CollectionProductId id;

        @Column(name = "sort_order", nullable = false)
        private Integer sortOrder;

        public CollectionProductId getId() {
            return id;
        }

        public void setId(CollectionProductId id) {
            this.id = id;
        }

        public Integer getSortOrder() {
            return sortOrder;
        }

        public void setSortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
        }
    }

    @Embeddable
    public static class CollectionProductId implements Serializable {

        @Column(name = "collection_id", nullable = false)
        private UUID collectionId;

        @Column(name = "product_id", nullable = false)
        private UUID productId;

        public CollectionProductId() {
        }

        public CollectionProductId(UUID collectionId, UUID productId) {
            this.collectionId = collectionId;
            this.productId = productId;
        }

        public UUID getCollectionId() {
            return collectionId;
        }

        public void setCollectionId(UUID collectionId) {
            this.collectionId = collectionId;
        }

        public UUID getProductId() {
            return productId;
        }

        public void setProductId(UUID productId) {
            this.productId = productId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof CollectionProductId that)) return false;
            return Objects.equals(collectionId, that.collectionId)
                    && Objects.equals(productId, that.productId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(collectionId, productId);
        }
    }
}
