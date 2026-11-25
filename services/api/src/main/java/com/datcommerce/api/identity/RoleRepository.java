package com.datcommerce.api.identity;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<RoleEntity, UUID> {
    Optional<RoleEntity> findByCode(String code);

    List<RoleEntity> findByCodeIn(Collection<String> codes);

    List<RoleEntity> findAllByOrderByCodeAsc();
}
