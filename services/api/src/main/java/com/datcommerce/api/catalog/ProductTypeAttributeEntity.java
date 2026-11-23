package com.datcommerce.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "product_type_attributes")
public class ProductTypeAttributeEntity {

    @EmbeddedId
    private ProductTypeAttributeId id;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "required_override")
    private Boolean requiredOverride;

    public ProductTypeAttributeId getId() {
        return id;
    }

    public void setId(ProductTypeAttributeId id) {
        this.id = id;
    }

    public Integer getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }

    public Boolean getRequiredOverride() {
        return requiredOverride;
    }

    public void setRequiredOverride(Boolean requiredOverride) {
        this.requiredOverride = requiredOverride;
    }

    @Embeddable
    public static class ProductTypeAttributeId implements Serializable {

        @Column(name = "product_type_id", nullable = false)
        private UUID productTypeId;

        @Column(name = "attribute_definition_id", nullable = false)
        private UUID attributeDefinitionId;

        public ProductTypeAttributeId() {
        }

        public ProductTypeAttributeId(UUID productTypeId, UUID attributeDefinitionId) {
            this.productTypeId = productTypeId;
            this.attributeDefinitionId = attributeDefinitionId;
        }

        public UUID getProductTypeId() {
            return productTypeId;
        }

        public void setProductTypeId(UUID productTypeId) {
            this.productTypeId = productTypeId;
        }

        public UUID getAttributeDefinitionId() {
            return attributeDefinitionId;
        }

        public void setAttributeDefinitionId(UUID attributeDefinitionId) {
            this.attributeDefinitionId = attributeDefinitionId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof ProductTypeAttributeId that)) return false;
            return Objects.equals(productTypeId, that.productTypeId)
                    && Objects.equals(attributeDefinitionId, that.attributeDefinitionId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(productTypeId, attributeDefinitionId);
        }
    }
}
