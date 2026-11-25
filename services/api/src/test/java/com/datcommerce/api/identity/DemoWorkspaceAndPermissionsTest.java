package com.datcommerce.api.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.datcommerce.api.ai.AiAdminController;
import com.datcommerce.api.cms.CmsAdminController;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import software.amazon.awssdk.services.s3.S3Client;

class DemoWorkspaceAndPermissionsTest {

    @Test
    void aiSettingsWriteAndPublishAnnotationsEnforceStrictPermissions() throws Exception {
        Method updateSettings = AiAdminController.class.getMethod(
                "updateSettings",
                AuthenticatedUser.class,
                com.datcommerce.api.ai.AiDtos.UpdateAiModelSettingsRequest.class
        );
        PreAuthorize aiSettingsAuth = updateSettings.getAnnotation(PreAuthorize.class);
        assertThat(aiSettingsAuth).isNotNull();
        assertThat(aiSettingsAuth.value()).isEqualTo("hasAuthority('ai:settings:write')");

        Method resetUsage = AiAdminController.class.getMethod(
                "resetCustomerUsage",
                AuthenticatedUser.class,
                UUID.class
        );
        PreAuthorize resetAuth = resetUsage.getAnnotation(PreAuthorize.class);
        assertThat(resetAuth).isNotNull();
        assertThat(resetAuth.value()).isEqualTo("hasAuthority('ai:settings:write')");

        Method publishPage = CmsAdminController.class.getMethod(
                "publishPage",
                AuthenticatedUser.class,
                UUID.class,
                com.datcommerce.api.cms.CmsService.PublishPageRequest.class
        );
        assertThat(publishPage.getAnnotation(PreAuthorize.class).value())
                .isEqualTo("hasAuthority('content:publish')");

        Method publishTheme = CmsAdminController.class.getMethod(
                "publishTheme",
                AuthenticatedUser.class,
                com.datcommerce.api.cms.CmsService.PublishThemeRequest.class
        );
        assertThat(publishTheme.getAnnotation(PreAuthorize.class).value())
                .isEqualTo("hasAuthority('content:publish')");
    }

    @Test
    void purgeDemoStoreRefusesNonDemoPrimaryStore() {
        StoreRepository storeRepo = mock(StoreRepository.class);
        StoreEntity primary = new StoreEntity();
        UUID primaryId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        primary.setId(primaryId);
        primary.setCode("terrain-supply");
        primary.setDemo(false);
        when(storeRepo.findById(primaryId)).thenReturn(Optional.of(primary));

        DemoWorkspaceService svc = new DemoWorkspaceService(
                storeRepo,
                mock(AdminUserRepository.class),
                mock(RoleRepository.class),
                mock(PasswordEncoder.class),
                mock(AuthService.class),
                mock(JdbcTemplate.class),
                mock(StringRedisTemplate.class),
                mock(S3Client.class),
                new AppProperties(),
                mock(PlatformTransactionManager.class)
        );

        assertThatThrownBy(() -> svc.purgeDemoStore(primaryId))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    void demoOwnerCannotCreatePrivilegedOwnerOrEditorUser() {
        RoleRepository roleRepo = mock(RoleRepository.class);
        RoleEntity ownerRole = new RoleEntity();
        ownerRole.setCode("OWNER");
        when(roleRepo.findByCodeIn(List.of("OWNER"))).thenReturn(List.of(ownerRole));

        AdminUserRepository userRepo = mock(AdminUserRepository.class);
        when(userRepo.existsByEmailIgnoreCase("evil@example.com")).thenReturn(false);

        AdminUserService adminUserService = new AdminUserService(
                userRepo,
                roleRepo,
                mock(RefreshTokenRepository.class),
                mock(PasswordEncoder.class),
                mock(com.datcommerce.api.audit.AuditLogService.class)
        );

        AuthenticatedUser demoActor = new AuthenticatedUser(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "demo@demo.datcommerce.local",
                "Demo Owner",
                List.of("DEMO_OWNER"),
                List.of("users:write")
        );

        assertThatThrownBy(() -> adminUserService.createUser(
                demoActor,
                new AdminUserService.CreateUserRequest("evil@example.com", "Evil", "Pass1234!", List.of("OWNER"))
        ))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getCode()).isEqualTo(ErrorCode.FORBIDDEN));
    }
}
