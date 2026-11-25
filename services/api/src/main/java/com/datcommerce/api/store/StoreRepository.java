package com.datcommerce.api.store;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoreRepository extends JpaRepository<StoreEntity, UUID> {
    Optional<StoreEntity> findByCode(String code);

    List<StoreEntity> findByDemoTrueAndDemoExpiresAtBefore(Instant cutoff);
}
