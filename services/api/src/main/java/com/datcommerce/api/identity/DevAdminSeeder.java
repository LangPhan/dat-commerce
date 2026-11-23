package com.datcommerce.api.identity;

import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DevAdminSeeder implements ApplicationRunner {

    private final StoreRepository storeRepository;
    private final AdminUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public DevAdminSeeder(
            StoreRepository storeRepository,
            AdminUserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        StoreEntity store = storeRepository.findByCode("terrain-supply")
                .orElseThrow(() -> new IllegalStateException("Default store missing after Flyway migrations"));

        seedUser(store.getId(), "owner@datcommerce.local", "Alex Morgan", "OwnerPass123!", "OWNER");
        seedUser(store.getId(), "admin@datcommerce.local", "Dat Nguyen", "AdminPass123!", "ADMIN");
        seedUser(store.getId(), "catalog@datcommerce.local", "Sora Takahashi", "CatalogPass123!", "CATALOG_MANAGER");
        seedUser(store.getId(), "editor@datcommerce.local", "Maya Lin", "EditorPass123!", "CONTENT_EDITOR");
        seedUser(store.getId(), "viewer@datcommerce.local", "Jordan Reed", "ViewerPass123!", "VIEWER");
    }

    private void seedUser(UUID storeId, String email, String fullName, String rawPassword, String roleCode) {
        if (userRepository.existsByEmailIgnoreCase(email)) {
            return;
        }
        List<RoleEntity> roles = roleRepository.findByCodeIn(List.of(roleCode));
        if (roles.isEmpty()) {
            throw new IllegalStateException("Seed role not found: " + roleCode);
        }
        Instant now = Instant.now();
        AdminUserEntity user = new AdminUserEntity();
        user.setId(UUID.randomUUID());
        user.setStoreId(storeId);
        user.setEmail(email);
        user.setFullName(fullName);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setStatus("ACTIVE");
        user.setRoles(Set.copyOf(roles));
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);
    }
}
