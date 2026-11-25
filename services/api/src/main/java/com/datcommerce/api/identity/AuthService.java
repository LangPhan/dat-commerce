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
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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

    @Transactional(noRollbackFor = ApiException.class)
    public AuthSessionResult register(RegisterRequest request, String userAgent, String ipAddress) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        String safeIp = StringUtils.hasText(ipAddress) ? ipAddress.trim() : "unknown";
        String rateLimitKey = "auth:rl:register:" + sha256Hex(safeIp);
        enforceRegisterRateLimit(rateLimitKey);

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ApiException(ErrorCode.CONFLICT, "An account with this email already exists");
        }

        StoreEntity store = storeRepository.findByCode("terrain-supply")
                .orElseGet(() -> storeRepository.findAll().stream().findFirst()
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Store not initialized")));

        Instant now = Instant.now();
        AdminUserEntity user = new AdminUserEntity();
        user.setId(UUID.randomUUID());
        user.setStoreId(store.getId());
        user.setEmail(normalizedEmail);
        user.setFullName(request.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setStatus("ACTIVE");
        user.setRoles(Set.of());
        user.setLastLoginAt(now);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);

        recordRegisterAttempt(rateLimitKey);

        String rawRefreshToken = generateOpaqueToken();
        saveRefreshToken(user.getId(), rawRefreshToken, userAgent, ipAddress, now);

        AuthenticatedUser principal = toPrincipal(user);
        String accessToken = jwtService.generateAccessToken(principal);

        auditLogService.record(
                store.getId(),
                user.getId(),
                user.getEmail(),
                "AUTH_REGISTER",
                "ACCOUNT",
                user.getId().toString(),
                null,
                Map.of("roles", List.of()),
                Map.of("ip", safeIp),
                null
        );

        return new AuthSessionResult(
                accessToken,
                rawRefreshToken,
                appProperties.getJwt().getAccessTtlSeconds(),
                MeResponse.from(principal, store.getName())
        );
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthSessionResult login(LoginRequest request, String userAgent, String ipAddress) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        String safeIp = StringUtils.hasText(ipAddress) ? ipAddress.trim() : "unknown";
        String rateLimitKey = "auth:rl:login:" + safeIp + ":" + sha256Hex(normalizedEmail);
        enforceLoginRateLimit(rateLimitKey);

        AdminUserEntity user = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (user == null
                || !"ACTIVE".equalsIgnoreCase(user.getStatus())
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            recordFailedLoginAttempt(rateLimitKey, normalizedEmail, safeIp);
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Invalid email or password");
        }

        clearLoginRateLimit(rateLimitKey);

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

    private void enforceRegisterRateLimit(String key) {
        try {
            String raw = redisTemplate.opsForValue().get(key);
            if (raw != null && Long.parseLong(raw) >= 15L) {
                throw new ApiException(
                        ErrorCode.RATE_LIMITED,
                        "Too many registration attempts from this network. Please retry later."
                );
            }
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ignored) {
            // Do not fail registration if Redis is unavailable
        }
    }

    private void recordRegisterAttempt(String key) {
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, Duration.ofMinutes(15));
            }
        } catch (Exception ignored) {
            // Best-effort counter
        }
    }

    private void enforceLoginRateLimit(String key) {
        try {
            String raw = redisTemplate.opsForValue().get(key);
            if (raw != null && Long.parseLong(raw) >= appProperties.getAuth().getLoginMaxFailures()) {
                throw new ApiException(
                        ErrorCode.RATE_LIMITED,
                        "Too many failed login attempts. Please retry later."
                );
            }
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ignored) {
            // Do not lock logins if Redis is momentarily unavailable
        }
    }

    private void recordFailedLoginAttempt(String key, String email, String ip) {
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, Duration.ofSeconds(Math.max(10, appProperties.getAuth().getLoginWindowSeconds())));
            }
        } catch (Exception ignored) {
            // Best-effort rate counter
        }
        try {
            UUID storeId = storeRepository.findAll().stream().findFirst().map(StoreEntity::getId).orElse(null);
            if (storeId != null) {
                auditLogService.record(
                        storeId, null, email,
                        "AUTH_LOGIN_FAILED", "SESSION", email,
                        null, null, Map.of("ip", ip), null
                );
            }
        } catch (Exception ignored) {
            // Do not mask UNAUTHORIZED
        }
    }

    private void clearLoginRateLimit(String key) {
        try {
            redisTemplate.delete(key);
        } catch (Exception ignored) {
            // Ignore cleanup failure
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

    public record RegisterRequest(
            @NotBlank @jakarta.validation.constraints.Size(min = 2, max = 160) String fullName,
            @NotBlank @Email @jakarta.validation.constraints.Size(max = 255) String email,
            @NotBlank @jakarta.validation.constraints.Size(min = 8, max = 128) String password
    ) {
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
