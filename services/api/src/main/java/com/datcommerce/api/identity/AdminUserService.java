package com.datcommerce.api.identity;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.common.web.PageResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminUserService {

    private final AdminUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    public AdminUserService(
            AdminUserRepository userRepository,
            RoleRepository roleRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            AuditLogService auditLogService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> listUsers(UUID storeId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        Page<UserResponse> users = userRepository
                .findAllByStoreIdOrderByCreatedAtDesc(storeId, PageRequest.of(safePage, safeSize))
                .map(UserResponse::from);
        return PageResponse.from(users);
    }

    @Transactional(readOnly = true)
    public List<RoleSummary> listRoles() {
        return roleRepository.findAllByOrderByCodeAsc().stream()
                .map(r -> new RoleSummary(r.getCode(), r.getName(), r.getDescription()))
                .toList();
    }

    @Transactional
    public UserResponse createUser(AuthenticatedUser actor, CreateUserRequest req) {
        String normalizedEmail = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ApiException(ErrorCode.CONFLICT, "An admin user with this email already exists");
        }

        Set<RoleEntity> resolvedRoles = resolveRoles(req.roles());
        Instant now = Instant.now();

        AdminUserEntity user = new AdminUserEntity();
        user.setId(UUID.randomUUID());
        user.setStoreId(actor.storeId());
        user.setEmail(normalizedEmail);
        user.setFullName(req.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setStatus("ACTIVE");
        user.setRoles(resolvedRoles);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);

        AdminUserEntity saved = userRepository.save(user);

        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "ADMIN_USER_CREATED",
                "ADMIN_USER",
                saved.getId().toString(),
                null,
                Map.of(
                        "email", saved.getEmail(),
                        "fullName", saved.getFullName(),
                        "status", saved.getStatus(),
                        "roles", resolvedRoles.stream().map(RoleEntity::getCode).sorted().toList()
                ),
                Map.of(),
                null
        );

        return UserResponse.from(saved);
    }

    @Transactional
    public UserResponse updateUser(AuthenticatedUser actor, UUID targetUserId, UpdateUserRequest req) {
        AdminUserEntity target = userRepository.findByIdAndStoreId(targetUserId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Admin user not found"));

        List<String> previousRoles = target.getRoles().stream().map(RoleEntity::getCode).sorted().toList();
        Map<String, Object> before = Map.of(
                "fullName", target.getFullName(),
                "status", target.getStatus(),
                "roles", previousRoles
        );

        if (req.fullName() != null && !req.fullName().isBlank()) {
            target.setFullName(req.fullName().trim());
        }

        if (req.status() != null && !req.status().isBlank()) {
            String nextStatus = req.status().trim().toUpperCase();
            if (!nextStatus.equals("ACTIVE") && !nextStatus.equals("DISABLED")) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "Status must be ACTIVE or DISABLED");
            }
            if (actor.userId().equals(target.getId()) && "DISABLED".equals(nextStatus)) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "You cannot disable your own account");
            }
            target.setStatus(nextStatus);
            if ("DISABLED".equals(nextStatus)) {
                refreshTokenRepository.revokeAllActiveByUserId(target.getId(), Instant.now());
            }
        }

        if (req.roles() != null && !req.roles().isEmpty()) {
            Set<RoleEntity> nextRoles = resolveRoles(req.roles());
            boolean hadOwner = previousRoles.contains("OWNER");
            boolean keepsOwner = nextRoles.stream().anyMatch(r -> "OWNER".equals(r.getCode()));
            if (actor.userId().equals(target.getId()) && hadOwner && !keepsOwner) {
                throw new ApiException(ErrorCode.BAD_REQUEST, "You cannot remove your own OWNER role");
            }
            target.setRoles(nextRoles);
        }

        target.setUpdatedAt(Instant.now());
        AdminUserEntity saved = userRepository.save(target);

        List<String> afterRoles = saved.getRoles().stream().map(RoleEntity::getCode).sorted().toList();
        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "ADMIN_USER_UPDATED",
                "ADMIN_USER",
                saved.getId().toString(),
                before,
                Map.of(
                        "fullName", saved.getFullName(),
                        "status", saved.getStatus(),
                        "roles", afterRoles
                ),
                Map.of(),
                null
        );

        return UserResponse.from(saved);
    }

    private Set<RoleEntity> resolveRoles(List<String> requestedCodes) {
        List<String> normalized = requestedCodes.stream()
                .map(c -> c.trim().toUpperCase())
                .distinct()
                .toList();
        List<RoleEntity> found = roleRepository.findByCodeIn(normalized);
        if (found.size() != normalized.size()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "One or more role codes are invalid");
        }
        return new HashSet<>(found);
    }

    public record CreateUserRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 160) String fullName,
            @NotBlank @Size(min = 8, max = 128) String password,
            @NotEmpty List<String> roles
    ) {
    }

    public record UpdateUserRequest(
            @Size(min = 1, max = 160) String fullName,
            String status,
            List<String> roles
    ) {
    }

    public record RoleSummary(String code, String name, String description) {
    }

    public record UserResponse(
            UUID id,
            String email,
            String fullName,
            String status,
            List<String> roles,
            Instant lastLoginAt,
            Instant createdAt
    ) {
        static UserResponse from(AdminUserEntity u) {
            return new UserResponse(
                    u.getId(),
                    u.getEmail(),
                    u.getFullName(),
                    u.getStatus(),
                    u.getRoles().stream().map(RoleEntity::getCode).sorted().toList(),
                    u.getLastLoginAt(),
                    u.getCreatedAt()
            );
        }
    }
}
