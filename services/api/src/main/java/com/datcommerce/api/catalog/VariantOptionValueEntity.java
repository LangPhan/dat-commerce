package com.datcommerce.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "variant_option_values")
public class VariantOptionValueEntity {

    @Id
    private UUID id;

    @Column(name = "variant_id", nullable = false)
    private UUID variantId;

    @Column(name = "option_name", nullable = false, length = 64)
    private String optionName;

    @Column(name = "option_value", nullable = false, length = 160)
    private String optionValue;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getVariantId() {
        return variantId;
    }

    public void setVariantId(UUID variantId) {
        this.variantId = variantId;
    }

    public String getOptionName() {
        return optionName;
    }

    public void setOptionName(String optionName) {
        this.optionName = optionName;
    }

    public String getOptionValue() {
        return optionValue;
    }

    public void setOptionValue(String optionValue) {
        this.optionValue = optionValue;
    }
}
