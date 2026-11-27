package com.datcommerce.api.experience;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonalExperienceRepository extends JpaRepository<SeasonalExperienceEntity, UUID> {
    List<SeasonalExperienceEntity> findAllByStoreIdOrderByPriorityDescUpdatedAtDesc(UUID storeId);

    Optional<SeasonalExperienceEntity> findByIdAndStoreId(UUID id, UUID storeId);

    Optional<SeasonalExperienceEntity> findByStoreIdAndSlugIgnoreCase(UUID storeId, String slug);

    List<SeasonalExperienceEntity> findAllByActivationModeAndManualOverrideFalse(String activationMode);
}
