package com.datcommerce.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "attribute_options")
public class AttributeOptionEntity {

    @Id
    private UUID id;

    @Column(name = "attribute_definition_id", nullable = false)
    private UUID attributeDefinitionId;

    @Column(nullable = false, length = 160)
    private String value;

    @Column(nullable = false, length = 160)
    private String label;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getAttributeDefinitionId() {
        return attributeDefinitionId;
    }

    public void setAttributeDefinitionId(UUID attributeDefinitionId) {
        this.attributeDefinitionId = attributeDefinitionId;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
