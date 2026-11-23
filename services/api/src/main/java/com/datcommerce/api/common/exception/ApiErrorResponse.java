package com.datcommerce.api.common.exception;

import java.time.Instant;
import java.util.List;

public record ApiErrorResponse(
        String code,
        String message,
        List<FieldErrorItem> fieldErrors,
        String requestId,
        Instant timestamp
) {
    public record FieldErrorItem(String field, String message) {
    }
}
