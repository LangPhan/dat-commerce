package com.datcommerce.api.identity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<RoleEntity, UUID> {
    List<RoleEntity> findByCodeIn(Collection<String> codes);

    List<RoleEntity> findAllByOrderByCodeAsc();
}
