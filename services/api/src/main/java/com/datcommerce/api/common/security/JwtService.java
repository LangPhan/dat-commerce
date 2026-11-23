package com.datcommerce.api.common.security;

import com.datcommerce.api.common.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long accessTtlSeconds;

    public JwtService(AppProperties properties) {
        this.signingKey = deriveKey(properties.getJwt().getSecret());
        this.accessTtlSeconds = properties.getJwt().getAccessTtlSeconds();
    }

    public String generateAccessToken(AuthenticatedUser user) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(accessTtlSeconds);
        return Jwts.builder()
                .subject(user.userId().toString())
                .claim("storeId", user.storeId().toString())
                .claim("email", user.email())
                .claim("fullName", user.fullName())
                .claim("roles", user.roles())
                .claim("permissions", user.permissions())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public AuthenticatedUser parseAccessToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        UUID userId = UUID.fromString(claims.getSubject());
        UUID storeId = UUID.fromString(claims.get("storeId", String.class));
        String email = claims.get("email", String.class);
        String fullName = claims.get("fullName", String.class);
        List<String> roles = stringListClaim(claims.get("roles"));
        List<String> permissions = stringListClaim(claims.get("permissions"));

        return new AuthenticatedUser(userId, storeId, email, fullName, roles, permissions);
    }

    private static List<String> stringListClaim(Object raw) {
        if (raw instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    private static SecretKey deriveKey(String rawSecret) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(rawSecret.getBytes(StandardCharsets.UTF_8));
            return Keys.hmacShaKeyFor(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
