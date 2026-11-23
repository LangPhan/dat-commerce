package com.datcommerce.api.cms;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PageVersionRepository extends JpaRepository<PageVersionEntity, UUID> {
    List<PageVersionEntity> findAllByPageIdOrderByVersionNumberDesc(UUID pageId);

    Optional<PageVersionEntity> findByIdAndPageId(UUID id, UUID pageId);

    Optional<PageVersionEntity> findTopByPageIdOrderByVersionNumberDesc(UUID pageId);
}
