package com.datcommerce.api.common.security;

import java.util.List;
import java.util.UUID;

public record AuthenticatedUser(
        UUID userId,
        UUID storeId,
        String email,
        String fullName,
        List<String> roles,
        List<String> permissions
) {
}
