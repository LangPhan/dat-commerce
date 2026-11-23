package com.datcommerce.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "variant_option_definitions")
public class VariantOptionDefinitionEntity {

    @Id
    private UUID id;

    @Column(name = "product_type_id", nullable = false)
    private UUID productTypeId;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getProductTypeId() {
        return productTypeId;
    }

    public void setProductTypeId(UUID productTypeId) {
        this.productTypeId = productTypeId;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
