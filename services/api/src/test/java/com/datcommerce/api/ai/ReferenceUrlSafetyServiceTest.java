package com.datcommerce.api.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.InetAddress;
import org.junit.jupiter.api.Test;

class ReferenceUrlSafetyServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void blocksMaliciousProtocolsSsrfAndPhishingVectors() {
        ReferenceUrlSafetyService svc = new ReferenceUrlSafetyService(
                mapper,
                host -> switch (host) {
                    case "internal-rebind.example.com" -> new InetAddress[]{InetAddress.getByName("127.0.0.1")};
                    case "cgnat-tailscale.example.com" -> new InetAddress[]{InetAddress.getByName("100.98.214.94")};
                    case "aws-meta.example.com" -> new InetAddress[]{InetAddress.getByName("169.254.169.254")};
                    case "rfc1918.example.com" -> new InetAddress[]{InetAddress.getByName("10.0.0.15")};
                    case "stripe.com" -> new InetAddress[]{InetAddress.getByName("93.184.216.34")};
                    default -> new InetAddress[]{InetAddress.getByName("93.184.216.34")};
                },
                ""
        );

        assertTrue(svc.assess("javascript:alert(1)").isBlocked());
        assertTrue(svc.assess("file:///etc/passwd").isBlocked());
        assertTrue(svc.assess("http://127.0.0.1:8080/admin").isBlocked());
        assertTrue(svc.assess("http://localhost:3000").isBlocked());
        assertTrue(svc.assess("http://postgres:5432").isBlocked());
        assertTrue(svc.assess("https://user:pass@stripe.com").isBlocked());
        assertTrue(svc.assess("https://xn--pple-43d.com/login").isBlocked());
        assertTrue(svc.assess("https://downloads.example.com/setup.exe").isBlocked());
        assertTrue(svc.assess("https://example.com/out?redirect=https://evil.com").isBlocked());
        assertTrue(svc.assess("https://internal-rebind.example.com").isBlocked());
        assertTrue(svc.assess("https://cgnat-tailscale.example.com").isBlocked());
        assertTrue(svc.assess("https://aws-meta.example.com/latest/meta-data/").isBlocked());
        assertTrue(svc.assess("https://rfc1918.example.com").isBlocked());

        ReferenceUrlSafetyService.UrlSafetyReport safe = svc.assess("https://stripe.com/payments");
        assertFalse(safe.isBlocked());
        assertEquals(ReferenceUrlSafetyService.VERDICT_SAFE, safe.verdict());

        ReferenceUrlSafetyService.UrlSafetyReport httpCaution = svc.assess("http://stripe.com/");
        assertFalse(httpCaution.isBlocked());
        assertEquals(ReferenceUrlSafetyService.VERDICT_CAUTION, httpCaution.verdict());
    }
}
