package com.datcommerce.api.payment;

import java.math.BigDecimal;
import java.util.UUID;

public interface PaymentGateway {

    PaymentChargeResult authorizeAndCapture(UUID orderId, BigDecimal amount, String currency, String paymentToken);

    record PaymentChargeResult(boolean success, String provider, String externalRef, String failureReason) {
    }
}
