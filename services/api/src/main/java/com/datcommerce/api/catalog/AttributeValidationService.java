package com.datcommerce.api.catalog;

import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttributeValidationService {

    public static final Set<String> VALID_TYPES = Set.of(
            "TEXT", "NUMBER", "BOOLEAN", "DATE", "ENUM", "MULTI_SELECT"
    );

    private final ProductTypeAttributeRepository typeAttributeRepository;
    private final AttributeDefinitionRepository attributeRepository;
    private final AttributeOptionRepository optionRepository;
    private final ProductAttributeValueRepository valueRepository;

    public AttributeValidationService(
            ProductTypeAttributeRepository typeAttributeRepository,
            AttributeDefinitionRepository attributeRepository,
            AttributeOptionRepository optionRepository,
            ProductAttributeValueRepository valueRepository
    ) {
        this.typeAttributeRepository = typeAttributeRepository;
        this.attributeRepository = attributeRepository;
        this.optionRepository = optionRepository;
        this.valueRepository = valueRepository;
    }

    @Transactional
    public void validateAndSaveProductAttributes(
            UUID productId,
            UUID productTypeId,
            Map<String, Object> rawAttributes,
            boolean checkExistingIncompatible,
            boolean confirmDropIncompatible
    ) {
        List<ProductTypeAttributeEntity> bindings =
                typeAttributeRepository.findAllByIdProductTypeIdOrderByDisplayOrderAsc(productTypeId);
        List<UUID> defIds = bindings.stream()
                .map(b -> b.getId().getAttributeDefinitionId())
                .toList();

        Map<UUID, AttributeDefinitionEntity> defsById = defIds.isEmpty()
                ? Map.of()
                : attributeRepository.findAllByIdIn(defIds).stream()
                        .filter(d -> d.getArchivedAt() == null)
                        .collect(Collectors.toMap(AttributeDefinitionEntity::getId, Function.identity()));

        Map<String, AttributeDefinitionEntity> defsByCode = new LinkedHashMap<>();
        Map<UUID, ProductTypeAttributeEntity> bindingByDefId = new HashMap<>();
        for (ProductTypeAttributeEntity binding : bindings) {
            UUID defId = binding.getId().getAttributeDefinitionId();
            AttributeDefinitionEntity def = defsById.get(defId);
            if (def != null) {
                defsByCode.put(def.getCode().toLowerCase(), def);
                bindingByDefId.put(defId, binding);
            }
        }

        if (checkExistingIncompatible) {
            List<ProductAttributeValueEntity> existing = valueRepository.findAllByProductId(productId);
            List<UUID> incompatibleIds = existing.stream()
                    .map(ProductAttributeValueEntity::getAttributeDefinitionId)
                    .filter(id -> !defsById.containsKey(id))
                    .toList();
            if (!incompatibleIds.isEmpty() && !confirmDropIncompatible) {
                List<String> names = attributeRepository.findAllByIdIn(incompatibleIds).stream()
                        .map(AttributeDefinitionEntity::getCode)
                        .toList();
                throw new ApiException(
                        ErrorCode.CONFLICT,
                        "Changing product type would drop existing attribute values: " + String.join(", ", names)
                );
            }
        }

        Map<String, Object> incoming = rawAttributes == null ? Map.of() : rawAttributes;
        for (String key : incoming.keySet()) {
            if (!defsByCode.containsKey(key.trim().toLowerCase())) {
                throw new ApiException(
                        ErrorCode.VALIDATION_ERROR,
                        "Attribute '" + key + "' is not configured for this product type"
                );
            }
        }

        Map<UUID, List<AttributeOptionEntity>> optionsByDefId = defIds.isEmpty()
                ? Map.of()
                : optionRepository.findAllByAttributeDefinitionIdInOrderBySortOrderAsc(defIds).stream()
                        .collect(Collectors.groupingBy(AttributeOptionEntity::getAttributeDefinitionId));

        List<ProductAttributeValueEntity> toSave = new ArrayList<>();
        for (ProductTypeAttributeEntity binding : bindings) {
            AttributeDefinitionEntity def = defsById.get(binding.getId().getAttributeDefinitionId());
            if (def == null) {
                continue;
            }
            boolean effectiveRequired = binding.getRequiredOverride() != null
                    ? binding.getRequiredOverride()
                    : def.isRequired();

            Object rawVal = findIncomingValue(incoming, def.getCode());
            if (isMissing(rawVal)) {
                if (effectiveRequired) {
                    throw new ApiException(
                            ErrorCode.VALIDATION_ERROR,
                            "Missing required attribute: " + def.getCode()
                    );
                }
                continue;
            }

            ProductAttributeValueEntity valEntity = new ProductAttributeValueEntity();
            valEntity.setId(UUID.randomUUID());
            valEntity.setProductId(productId);
            valEntity.setAttributeDefinitionId(def.getId());
            populateTypedValue(valEntity, def, optionsByDefId.getOrDefault(def.getId(), List.of()), rawVal);
            toSave.add(valEntity);
        }

        valueRepository.deleteAllByProductId(productId);
        valueRepository.flush();
        if (!toSave.isEmpty()) {
            valueRepository.saveAll(toSave);
        }
    }

    private static Object findIncomingValue(Map<String, Object> incoming, String code) {
        if (incoming.containsKey(code)) {
            return incoming.get(code);
        }
        for (Map.Entry<String, Object> e : incoming.entrySet()) {
            if (e.getKey().trim().equalsIgnoreCase(code)) {
                return e.getValue();
            }
        }
        return null;
    }

    private static boolean isMissing(Object val) {
        if (val == null) return true;
        if (val instanceof String s) return s.trim().isEmpty();
        if (val instanceof Collection<?> c) return c.isEmpty();
        return false;
    }

    private static void populateTypedValue(
            ProductAttributeValueEntity target,
            AttributeDefinitionEntity def,
            List<AttributeOptionEntity> options,
            Object rawVal
    ) {
        Map<String, Object> rules = def.getValidationRulesJson() == null ? Map.of() : def.getValidationRulesJson();
        switch (def.getDataType()) {
            case "NUMBER" -> {
                BigDecimal num;
                try {
                    num = new BigDecimal(String.valueOf(rawVal).trim());
                } catch (NumberFormatException ex) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Attribute '" + def.getCode() + "' must be a number");
                }
                if (rules.get("min") != null) {
                    BigDecimal min = new BigDecimal(String.valueOf(rules.get("min")));
                    if (num.compareTo(min) < 0) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Attribute '" + def.getCode() + "' must be >= " + min);
                    }
                }
                if (rules.get("max") != null) {
                    BigDecimal max = new BigDecimal(String.valueOf(rules.get("max")));
                    if (num.compareTo(max) > 0) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Attribute '" + def.getCode() + "' must be <= " + max);
                    }
                }
                target.setValueNumber(num);
            }
            case "BOOLEAN" -> {
                if (rawVal instanceof Boolean b) {
                    target.setValueBoolean(b);
                } else {
                    String s = String.valueOf(rawVal).trim().toLowerCase();
                    if ("true".equals(s) || "yes".equals(s) || "1".equals(s)) {
                        target.setValueBoolean(true);
                    } else if ("false".equals(s) || "no".equals(s) || "0".equals(s)) {
                        target.setValueBoolean(false);
                    } else {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Attribute '" + def.getCode() + "' must be a boolean");
                    }
                }
            }
            case "DATE" -> {
                try {
                    target.setValueDate(LocalDate.parse(String.valueOf(rawVal).trim()));
                } catch (DateTimeParseException ex) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Attribute '" + def.getCode() + "' must be YYYY-MM-DD");
                }
            }
            case "ENUM" -> {
                String candidate = String.valueOf(rawVal).trim();
                String matched = options.stream()
                        .map(AttributeOptionEntity::getValue)
                        .filter(opt -> opt.equalsIgnoreCase(candidate))
                        .findFirst()
                        .orElseThrow(() -> new ApiException(
                                ErrorCode.VALIDATION_ERROR,
                                "Invalid option '" + candidate + "' for attribute '" + def.getCode() + "'"
                        ));
                target.setValueText(matched);
            }
            case "MULTI_SELECT" -> {
                List<String> candidates = new ArrayList<>();
                if (rawVal instanceof Collection<?> col) {
                    for (Object o : col) {
                        if (o != null && !String.valueOf(o).trim().isEmpty()) {
                            candidates.add(String.valueOf(o).trim());
                        }
                    }
                } else {
                    for (String part : String.valueOf(rawVal).split("\\s*[/,]\\s*")) {
                        if (!part.trim().isEmpty()) {
                            candidates.add(part.trim());
                        }
                    }
                }
                if (candidates.isEmpty()) {
                    throw new ApiException(ErrorCode.VALIDATION_ERROR, "Attribute '" + def.getCode() + "' requires at least one selection");
                }
                List<String> normalized = new ArrayList<>();
                for (String c : candidates) {
                    String matched = options.stream()
                            .map(AttributeOptionEntity::getValue)
                            .filter(opt -> opt.equalsIgnoreCase(c))
                            .findFirst()
                            .orElseThrow(() -> new ApiException(
                                    ErrorCode.VALIDATION_ERROR,
                                    "Invalid option '" + c + "' for attribute '" + def.getCode() + "'"
                            ));
                    if (!normalized.contains(matched)) {
                        normalized.add(matched);
                    }
                }
                target.setValueJson(normalized);
            }
            case "TEXT" -> {
                String str = String.valueOf(rawVal).trim();
                if (rules.get("regex") != null) {
                    String pattern = String.valueOf(rules.get("regex"));
                    if (!Pattern.matches(pattern, str)) {
                        throw new ApiException(ErrorCode.VALIDATION_ERROR, "Attribute '" + def.getCode() + "' does not match required format");
                    }
                }
                target.setValueText(str);
            }
            default -> throw new ApiException(ErrorCode.BAD_REQUEST, "Unsupported attribute dataType: " + def.getDataType());
        }
    }

    public static Object extractRawValue(ProductAttributeValueEntity v, String dataType) {
        return switch (dataType) {
            case "NUMBER" -> v.getValueNumber();
            case "BOOLEAN" -> v.getValueBoolean();
            case "DATE" -> v.getValueDate() != null ? v.getValueDate().toString() : null;
            case "MULTI_SELECT" -> v.getValueJson();
            default -> v.getValueText();
        };
    }

    public static String formatDisplayValue(ProductAttributeValueEntity v, AttributeDefinitionEntity def) {
        Object raw = extractRawValue(v, def.getDataType());
        if (raw == null) return "";
        if ("NUMBER".equals(def.getDataType()) && raw instanceof BigDecimal bd) {
            String stripped = bd.stripTrailingZeros().toPlainString();
            return def.getUnit() != null && !def.getUnit().isBlank()
                    ? stripped + " " + def.getUnit()
                    : stripped;
        }
        if ("BOOLEAN".equals(def.getDataType()) && raw instanceof Boolean b) {
            return b ? "Yes" : "No";
        }
        if ("MULTI_SELECT".equals(def.getDataType()) && raw instanceof List<?> list) {
            return list.stream().map(String::valueOf).collect(Collectors.joining(" / "));
        }
        String text = String.valueOf(raw);
        return def.getUnit() != null && !def.getUnit().isBlank() && !"TEXT".equals(def.getDataType())
                ? text + " " + def.getUnit()
                : text;
    }
}
