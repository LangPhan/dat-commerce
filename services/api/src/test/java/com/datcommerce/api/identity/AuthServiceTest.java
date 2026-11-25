package com.datcommerce.api.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.JwtService;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

    @Test
    void registersCustomerWithEmptyRolesAndRejectsDuplicates() {
        AdminUserRepository userRepo = mock(AdminUserRepository.class);
        RefreshTokenRepository refreshRepo = mock(RefreshTokenRepository.class);
        StoreRepository storeRepo = mock(StoreRepository.class);
        PasswordEncoder encoder = new BCryptPasswordEncoder();
        AppProperties props = new AppProperties();
        props.getJwt().setSecret("test-jwt-secret-key-at-least-32-chars-long-12345");
        JwtService jwtService = new JwtService(props);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        AuditLogService audit = mock(AuditLogService.class);

        StoreEntity store = new StoreEntity();
        UUID storeId = UUID.randomUUID();
        store.setId(storeId);
        store.setCode("terrain-supply");
        store.setName("Terrain Supply");
        when(storeRepo.findByCode("terrain-supply")).thenReturn(Optional.of(store));
        when(userRepo.existsByEmailIgnoreCase("buyer@example.com")).thenReturn(false);
        when(userRepo.save(any(AdminUserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(refreshRepo.save(any(RefreshTokenEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AuthService authService = new AuthService(
                userRepo, refreshRepo, storeRepo, encoder, jwtService, props, redis, audit
        );

        AuthService.AuthSessionResult res = authService.register(
                new AuthService.RegisterRequest("Linh Tran", "buyer@example.com", "StrongPass123!"),
                "JUnit",
                "1.2.3.4"
        );
        assertNotNull(res.accessToken());
        assertNotNull(res.refreshToken());
        assertEquals("buyer@example.com", res.user().email());
        assertTrue(res.user().roles().isEmpty());
        assertTrue(res.user().permissions().isEmpty());

        // Duplicate email -> 409 CONFLICT
        when(userRepo.existsByEmailIgnoreCase("dup@example.com")).thenReturn(true);
        ApiException conflict = assertThrows(ApiException.class, () -> authService.register(
                new AuthService.RegisterRequest("Dup", "dup@example.com", "StrongPass123!"),
                "JUnit",
                "1.2.3.4"
        ));
        assertEquals(ErrorCode.CONFLICT, conflict.getCode());

        // Admin role login includes role code
        AdminUserEntity admin = new AdminUserEntity();
        admin.setId(UUID.randomUUID());
        admin.setStoreId(storeId);
        admin.setEmail("owner@datcommerce.local");
        admin.setFullName("Alex Morgan");
        admin.setPasswordHash(encoder.encode("OwnerPass123!"));
        admin.setStatus("ACTIVE");
        RoleEntity ownerRole = new RoleEntity();
        ownerRole.setId(UUID.randomUUID());
        ownerRole.setCode("OWNER");
        ownerRole.setName("Owner");
        admin.setRoles(Set.of(ownerRole));

        when(userRepo.findByEmailIgnoreCase("owner@datcommerce.local")).thenReturn(Optional.of(admin));
        when(storeRepo.findById(storeId)).thenReturn(Optional.of(store));

        AuthService.AuthSessionResult adminRes = authService.login(
                new AuthService.LoginRequest("owner@datcommerce.local", "OwnerPass123!"),
                "JUnit",
                "1.2.3.4"
        );
        assertEquals(1, adminRes.user().roles().size());
        assertEquals("OWNER", adminRes.user().roles().get(0));
    }
}
