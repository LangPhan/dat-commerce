package com.datcommerce.api.cms;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NavigationMenuRepository extends JpaRepository<NavigationMenuEntity, UUID> {
    Optional<NavigationMenuEntity> findByStoreIdAndMenuKeyIgnoreCase(UUID storeId, String menuKey);
}
