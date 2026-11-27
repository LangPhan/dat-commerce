package com.datcommerce.api.experience;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonalExperienceVersionRepository extends JpaRepository<SeasonalExperienceVersionEntity, UUID> {
    List<SeasonalExperienceVersionEntity> findAllByExperienceIdOrderByVersionNumberDesc(UUID experienceId);

    Optional<SeasonalExperienceVersionEntity> findTopByExperienceIdOrderByVersionNumberDesc(UUID experienceId);

    Optional<SeasonalExperienceVersionEntity> findByIdAndExperienceId(UUID id, UUID experienceId);
}
