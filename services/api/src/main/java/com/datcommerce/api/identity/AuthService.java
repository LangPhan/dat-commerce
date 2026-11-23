package com.datcommerce.api.identity;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.common.security.JwtService;
import com.datcommerce.api.store.StoreEntity;
import com.datcommerce.api.store.StoreRepository;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AuthService {

    private static final String REDIS_REVOKED_PREFIX = "auth:revoked:";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AdminUserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AppProperties appProperties;
    private final StringRedisTemplate redisTemplate;
    private final AuditLogService auditLogService;

    public AuthService(
            AdminUserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            StoreRepository storeRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AppProperties appProperties,
            StringRedisTemplate redisTemplate,
            AuditLogService auditLogService
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.storeRepository = storeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.appProperties = appProperties;
        this.redisTemplate = redisTemplate;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public AuthSessionResult login(LoginRequest request, String userAgent, String ipAddress) {
        AdminUserEntity user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Invalid email or password"));

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Invalid email or password");
        }

        Instant now = Instant.now();
        user.setLastLoginAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);

        String rawRefreshToken = generateOpaqueToken();
        saveRefreshToken(user.getId(), rawRefreshToken, userAgent, ipAddress, now);

        AuthenticatedUser principal = toPrincipal(user);
        String accessToken = jwtService.generateAccessToken(principal);
        String storeName = storeNameFor(user.getStoreId());

        auditLogService.record(
                user.getStoreId(),
                user.getId(),
                user.getEmail(),
                "AUTH_LOGIN",
                "SESSION",
                user.getId().toString(),
                null,
                Map.of("roles", principal.roles()),
                Map.of("ip", ipAddress == null ? "" : ipAddress),
                null
        );

        return new AuthSessionResult(
                accessToken,
                rawRefreshToken,
                appProperties.getJwt().getAccessTtlSeconds(),
                MeResponse.from(principal, storeName)
        );
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthSessionResult refresh(String rawRefreshToken, String userAgent, String ipAddress) {
        if (!StringUtils.hasText(rawRefreshToken)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Refresh token is required");
        }

        String tokenHash = sha256Hex(rawRefreshToken);
        RefreshTokenEntity existing = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Invalid refresh token"));

        Instant now = Instant.now();
        boolean revokedInRedis = Boolean.TRUE.equals(redisTemplate.hasKey(REDIS_REVOKED_PREFIX + tokenHash));

        if (existing.getRevokedAt() != null || revokedInRedis) {
            refreshTokenRepository.revokeAllActiveByUserId(existing.getUserId(), now);
            userRepository.findById(existing.getUserId()).ifPresent(u -> auditLogService.record(
                    u.getStoreId(),
                    u.getId(),
                    u.getEmail(),
                    "AUTH_REFRESH_REUSE_DETECTED",
                    "SESSION",
                    u.getId().toString(),
                    null,
                    null,
                    Map.of("revokedAllSessions", true),
                    null
            ));
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Refresh token has been revoked");
        }

        if (existing.getExpiresAt().isBefore(now)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Refresh token has expired");
        }

        AdminUserEntity user = userRepository.findWithRolesById(existing.getUserId())
                .filter(u -> "ACTIVE".equalsIgnoreCase(u.getStatus()))
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "User account is unavailable"));

        // Ensure roles and permissions are loaded inside transaction
        AuthenticatedUser principal = toPrincipal(user);

        String newRawRefresh = generateOpaqueToken();
        RefreshTokenEntity rotated = saveRefreshToken(user.getId(), newRawRefresh, userAgent, ipAddress, now);
        existing.setRevokedAt(now);
        existing.setReplacedById(rotated.getId());
        refreshTokenRepository.save(existing);
        markRevokedInRedis(existing.getTokenHash(), existing.getExpiresAt(), now);

        String accessToken = jwtService.generateAccessToken(principal);
        String storeName = storeNameFor(user.getStoreId());

        return new AuthSessionResult(
                accessToken,
                newRawRefresh,
                appProperties.getJwt().getAccessTtlSeconds(),
                MeResponse.from(principal, storeName)
        );
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (!StringUtils.hasText(rawRefreshToken)) {
            return;
        }
        String tokenHash = sha256Hex(rawRefreshToken);
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(token -> {
            Instant now = Instant.now();
            if (token.getRevokedAt() == null) {
                token.setRevokedAt(now);
                refreshTokenRepository.save(token);
            }
            markRevokedInRedis(tokenHash, token.getExpiresAt(), now);

            userRepository.findById(token.getUserId()).ifPresent(user -> auditLogService.record(
                    user.getStoreId(),
                    user.getId(),
                    user.getEmail(),
                    "AUTH_LOGOUT",
                    "SESSION",
                    user.getId().toString(),
                    null,
                    null,
                    Map.of(),
                    null
            ));
        });
    }

    @Transactional(readOnly = true)
    public MeResponse me(AuthenticatedUser principal) {
        return MeResponse.from(principal, storeNameFor(principal.storeId()));
    }

    public AuthenticatedUser toPrincipal(AdminUserEntity user) {
        List<String> roles = user.getRoles().stream()
                .map(RoleEntity::getCode)
                .sorted()
                .toList();
        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(PermissionEntity::getCode)
                .distinct()
                .sorted()
                .toList();
        return new AuthenticatedUser(
                user.getId(),
                user.getStoreId(),
                user.getEmail(),
                user.getFullName(),
                roles,
                permissions
        );
    }

    private RefreshTokenEntity saveRefreshToken(
            UUID userId,
            String rawToken,
            String userAgent,
            String ipAddress,
            Instant now
    ) {
        RefreshTokenEntity entity = new RefreshTokenEntity();
        entity.setId(UUID.randomUUID());
        entity.setUserId(userId);
        entity.setTokenHash(sha256Hex(rawToken));
        entity.setExpiresAt(now.plusSeconds(appProperties.getJwt().getRefreshTtlSeconds()));
        entity.setUserAgent(truncate(userAgent, 500));
        entity.setIpAddress(truncate(ipAddress, 64));
        entity.setCreatedAt(now);
        return refreshTokenRepository.save(entity);
    }

    private void markRevokedInRedis(String tokenHash, Instant expiresAt, Instant now) {
        Duration ttl = Duration.between(now, expiresAt);
        if (!ttl.isNegative() && !ttl.isZero()) {
            redisTemplate.opsForValue().set(REDIS_REVOKED_PREFIX + tokenHash, "1", ttl);
        }
    }

    private String storeNameFor(UUID storeId) {
        return storeRepository.findById(storeId)
                .map(StoreEntity::getName)
                .orElse("Dat Commerce");
    }

    private static String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private static String truncate(String val, int maxLen) {
        if (val == null) return null;
        return val.length() <= maxLen ? val : val.substring(0, maxLen);
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {
    }

    public record RefreshRequest(String refreshToken) {
    }

    public record MeResponse(
            UUID id,
            UUID storeId,
            String storeName,
            String email,
            String fullName,
            List<String> roles,
            List<String> permissions
    ) {
        static MeResponse from(AuthenticatedUser user, String storeName) {
            return new MeResponse(
                    user.userId(),
                    user.storeId(),
                    storeName,
                    user.email(),
                    user.fullName(),
                    user.roles(),
                    user.permissions()
            );
        }
    }

    public record AuthTokenResponse(
            String accessToken,
            long expiresInSeconds,
            MeResponse user
    ) {
    }

    public record AuthSessionResult(
            String accessToken,
            String refreshToken,
            long expiresInSeconds,
            MeResponse user
    ) {
        public AuthTokenResponse toBody() {
            return new AuthTokenResponse(accessToken, expiresInSeconds, user);
        }
    }
}
