package com.datcommerce.api.identity;

import com.datcommerce.api.common.security.AuthenticatedUser;
import com.datcommerce.api.common.web.PageResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminUserController {

    private final AuthService authService;
    private final AdminUserService adminUserService;

    public AdminUserController(AuthService authService, AdminUserService adminUserService) {
        this.authService = authService;
        this.adminUserService = adminUserService;
    }

    @GetMapping("/me")
    public AuthService.MeResponse me(@AuthenticationPrincipal AuthenticatedUser user) {
        return authService.me(user);
    }

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('users:read')")
    public PageResponse<AdminUserService.UserResponse> listUsers(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return adminUserService.listUsers(user.storeId(), page, size);
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('users:read')")
    public List<AdminUserService.RoleSummary> listRoles() {
        return adminUserService.listRoles();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('users:write')")
    public AdminUserService.UserResponse createUser(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody AdminUserService.CreateUserRequest request
    ) {
        return adminUserService.createUser(user, request);
    }

    @PatchMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('users:write')")
    public AdminUserService.UserResponse updateUser(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID userId,
            @Valid @RequestBody AdminUserService.UpdateUserRequest request
    ) {
        return adminUserService.updateUser(user, userId, request);
    }
}
