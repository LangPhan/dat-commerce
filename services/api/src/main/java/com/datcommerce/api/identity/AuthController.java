package com.datcommerce.api.identity;

import com.datcommerce.api.common.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final DemoWorkspaceService demoWorkspaceService;
    private final AppProperties appProperties;

    public AuthController(
            AuthService authService,
            DemoWorkspaceService demoWorkspaceService,
            AppProperties appProperties
    ) {
        this.authService = authService;
        this.demoWorkspaceService = demoWorkspaceService;
        this.appProperties = appProperties;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthService.AuthTokenResponse> login(
            @Valid @RequestBody AuthService.LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        AuthService.AuthSessionResult result = authService.login(
                body,
                request.getHeader(HttpHeaders.USER_AGENT),
                clientIp(request)
        );
        writeRefreshCookie(response, result.refreshToken(), appProperties.getJwt().getRefreshTtlSeconds());
        return ResponseEntity.ok(result.toBody());
    }

    @PostMapping("/register")
    public ResponseEntity<AuthService.AuthTokenResponse> register(
            @Valid @RequestBody AuthService.RegisterRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        AuthService.AuthSessionResult result = authService.register(
                body,
                request.getHeader(HttpHeaders.USER_AGENT),
                clientIp(request)
        );
        writeRefreshCookie(response, result.refreshToken(), appProperties.getJwt().getRefreshTtlSeconds());
        return ResponseEntity.status(HttpStatus.CREATED).body(result.toBody());
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthService.AuthTokenResponse> refresh(
            @RequestBody(required = false) AuthService.RefreshRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String token = extractRefreshToken(request, body);
        AuthService.AuthSessionResult result = authService.refresh(
                token,
                request.getHeader(HttpHeaders.USER_AGENT),
                clientIp(request)
        );
        writeRefreshCookie(response, result.refreshToken(), appProperties.getJwt().getRefreshTtlSeconds());
        return ResponseEntity.ok(result.toBody());
    }

    @PostMapping("/demo-owner")
    public ResponseEntity<AuthService.AuthTokenResponse> startDemoOwner(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        AuthService.AuthSessionResult result = demoWorkspaceService.startDemoOwnerSession(
                request.getHeader(HttpHeaders.USER_AGENT),
                clientIp(request)
        );
        writeRefreshCookie(response, result.refreshToken(), DemoWorkspaceService.DEMO_TTL.toSeconds());
        return ResponseEntity.status(HttpStatus.CREATED).body(result.toBody());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestBody(required = false) AuthService.RefreshRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String token = extractRefreshToken(request, body);
        authService.logout(token);
        writeRefreshCookie(response, "", 0);
        return ResponseEntity.noContent().build();
    }

    private String extractRefreshToken(HttpServletRequest request, AuthService.RefreshRequest body) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            String cookieName = appProperties.getCookie().getName();
            for (Cookie cookie : cookies) {
                if (cookieName.equals(cookie.getName()) && StringUtils.hasText(cookie.getValue())) {
                    return cookie.getValue();
                }
            }
        }
        return body != null ? body.refreshToken() : null;
    }

    private void writeRefreshCookie(HttpServletResponse response, String value, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(appProperties.getCookie().getName(), value)
                .httpOnly(true)
                .secure(appProperties.getCookie().isSecure())
                .sameSite(appProperties.getCookie().getSameSite())
                .path("/api/v1/auth")
                .maxAge(maxAgeSeconds)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }
}
