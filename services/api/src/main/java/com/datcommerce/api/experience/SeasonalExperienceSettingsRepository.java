package com.datcommerce.api.experience;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonalExperienceSettingsRepository extends JpaRepository<SeasonalExperienceSettingsEntity, UUID> {
}
