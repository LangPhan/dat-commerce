package com.datcommerce.api.identity;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminUserRepository extends JpaRepository<AdminUserEntity, UUID> {

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<AdminUserEntity> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<AdminUserEntity> findWithRolesById(UUID id);

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<AdminUserEntity> findByIdAndStoreId(UUID id, UUID storeId);

    boolean existsByEmailIgnoreCase(String email);

    Page<AdminUserEntity> findAllByStoreIdOrderByCreatedAtDesc(UUID storeId, Pageable pageable);
}
