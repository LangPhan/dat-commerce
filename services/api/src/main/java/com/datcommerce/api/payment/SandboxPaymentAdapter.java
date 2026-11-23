package com.datcommerce.api.payment;

import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class SandboxPaymentAdapter implements PaymentGateway {

    @Override
    public PaymentChargeResult authorizeAndCapture(
            UUID orderId,
            BigDecimal amount,
            String currency,
            String paymentToken
    ) {
        if ("FAIL".equalsIgnoreCase(paymentToken)) {
            return new PaymentChargeResult(false, "SANDBOX", null, "Card declined by sandbox processor");
        }
        String ref = "pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return new PaymentChargeResult(true, "SANDBOX", ref, null);
    }
}
