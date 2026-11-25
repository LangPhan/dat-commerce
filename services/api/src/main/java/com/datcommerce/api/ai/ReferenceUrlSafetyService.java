package com.datcommerce.api.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class ReferenceUrlSafetyService {

    private static final Logger log = LoggerFactory.getLogger(ReferenceUrlSafetyService.class);

    public static final String VERDICT_SAFE = "SAFE";
    public static final String VERDICT_CAUTION = "CAUTION";
    public static final String VERDICT_BLOCKED = "BLOCKED";

    private static final int MAX_URL_LENGTH = 2048;

    private static final Set<String> BLOCKED_INTERNAL_HOSTS = Set.of(
            "localhost",
            "localhost.localdomain",
            "ip6-localhost",
            "ip6-loopback",
            "metadata.google.internal",
            "metadata",
            "postgres",
            "redis",
            "silo",
            "9router",
            "api",
            "web",
            "caddy",
            "host.docker.internal"
    );

    private static final Set<String> DANGEROUS_EXTENSIONS = Set.of(
            ".exe", ".msi", ".apk", ".bat", ".cmd", ".sh", ".ps1",
            ".scr", ".dll", ".vbs", ".jar", ".dmg", ".pkg", ".zip", ".rar", ".7z", ".iso"
    );

    private static final Set<String> HIGH_ABUSE_TLDS = Set.of(
            ".zip", ".mov", ".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".xyz", ".click", ".work"
    );

    private static final Pattern IPV4_LITERAL = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");
    private static final Pattern OPEN_REDIRECT_QUERY = Pattern.compile(
            "(?i)(?:^|&)(?:redirect|redir|next|url|target|dest|destination|return|continue|goto)=(?:https?%3a|https?://|//)"
    );
    private static final Pattern PHISHING_PATH_PATTERN = Pattern.compile(
            "(?i)/(?:wp-admin|wp-includes|signin-verify|verify-account|account-suspended|wallet-connect|seed-phrase|paypal-verify|bank-login)"
    );
    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\u0000-\\u001F\\u007F]");

    private final ObjectMapper objectMapper;
    private final DnsResolver dnsResolver;
    private final String safeBrowsingApiKey;
    private final HttpClient threatClient;

    public interface DnsResolver {
        InetAddress[] resolve(String host) throws UnknownHostException;
    }

    @Autowired
    public ReferenceUrlSafetyService(
            ObjectMapper objectMapper,
            @Value("${app.ai.safe-browsing-api-key:}") String safeBrowsingApiKey
    ) {
        this(objectMapper, InetAddress::getAllByName, safeBrowsingApiKey);
    }

    ReferenceUrlSafetyService(
            ObjectMapper objectMapper,
            DnsResolver dnsResolver,
            String safeBrowsingApiKey
    ) {
        this.objectMapper = objectMapper;
        this.dnsResolver = dnsResolver;
        this.safeBrowsingApiKey = safeBrowsingApiKey != null ? safeBrowsingApiKey.trim() : "";
        this.threatClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(4))
                .build();
    }

    public UrlSafetyReport assess(String rawUrl) {
        List<String> reasons = new ArrayList<>();
        int riskScore = 0;

        if (!StringUtils.hasText(rawUrl)) {
            return new UrlSafetyReport("", "", VERDICT_BLOCKED, 100, List.of("URL is empty"));
        }
        String trimmed = rawUrl.trim();
        if (trimmed.length() > MAX_URL_LENGTH) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("URL exceeds maximum length (2048 chars)"));
        }
        if (CONTROL_CHARS.matcher(trimmed).find() || trimmed.contains(" ") || trimmed.contains("\\")) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("URL contains invalid whitespace, backslashes, or control characters"));
        }

        // Layer 1: Protocol & lexical safety
        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException ex) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("Malformed URL syntax"));
        }

        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
        if (!"https".equals(scheme) && !"http".equals(scheme)) {
            return new UrlSafetyReport(
                    trimmed, "", VERDICT_BLOCKED, 100,
                    List.of("Blocked unsafe URL scheme '" + (scheme.isEmpty() ? "missing" : scheme) + "'. Only https:// or http:// links are permitted.")
            );
        }
        if ("http".equals(scheme)) {
            riskScore += 15;
            reasons.add("Unencrypted HTTP link (HTTPS recommended)");
        }
        if (StringUtils.hasText(uri.getUserInfo())) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("URLs with embedded credentials (user:pass@host) are blocked as a phishing vector"));
        }

        String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
        if (!StringUtils.hasText(host)) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("URL is missing a valid hostname"));
        }

        int port = uri.getPort();
        if (port != -1 && port != 80 && port != 443) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 95, List.of("Non-standard port :" + port + " is blocked to prevent internal service probing"));
        }

        if (BLOCKED_INTERNAL_HOSTS.contains(host)
                || host.endsWith(".local")
                || host.endsWith(".internal")
                || host.endsWith(".localhost")
                || host.endsWith(".lan")
                || host.endsWith(".home.arpa")
                || !host.contains(".")) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("Internal or non-public hostname '" + host + "' is blocked (SSRF protection)"));
        }

        if (IPV4_LITERAL.matcher(host).matches() || host.startsWith("[") || host.contains(":")) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("Direct IP address URLs are blocked; provide a public domain name"));
        }

        if (host.contains("xn--")) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 90, List.of("Punycode/IDN homograph domain ('xn--') blocked due to spoofing risk"));
        }

        if (host.chars().filter(ch -> ch == '.').count() >= 5) {
            riskScore += 30;
            reasons.add("Unusually deep subdomain chain (possible phishing camouflage)");
        }

        String pathLower = uri.getRawPath() != null ? uri.getRawPath().toLowerCase(Locale.ROOT) : "";
        for (String ext : DANGEROUS_EXTENSIONS) {
            if (pathLower.endsWith(ext)) {
                return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 100, List.of("Blocked downloadable/executable file link (" + ext + ")"));
            }
        }
        if (PHISHING_PATH_PATTERN.matcher(pathLower).find()) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 95, List.of("URL path matches known phishing or credential-harvesting pattern"));
        }

        String rawQuery = uri.getRawQuery() != null ? uri.getRawQuery() : "";
        if (OPEN_REDIRECT_QUERY.matcher(rawQuery).find()) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 90, List.of("URL contains a chained external open-redirect parameter"));
        }

        for (String tld : HIGH_ABUSE_TLDS) {
            if (host.endsWith(tld)) {
                riskScore += 25;
                reasons.add("Domain uses a higher-risk TLD (" + tld + ")");
                break;
            }
        }

        // Layer 2: Strict DNS resolution + Anti-SSRF IP inspection
        try {
            InetAddress[] addresses = dnsResolver.resolve(host);
            if (addresses == null || addresses.length == 0) {
                return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 90, List.of("Domain could not be resolved via DNS"));
            }
            for (InetAddress addr : addresses) {
                String blockReason = checkRestrictedIp(addr);
                if (blockReason != null) {
                    return new UrlSafetyReport(
                            trimmed, "", VERDICT_BLOCKED, 100,
                            List.of("Domain resolves to restricted network address (" + blockReason + ") — blocked by SSRF guard")
                    );
                }
            }
        } catch (UnknownHostException ex) {
            return new UrlSafetyReport(trimmed, "", VERDICT_BLOCKED, 85, List.of("Domain hostname does not resolve: " + host));
        }

        // Layer 3: Optional Google Safe Browsing v4 threat lookup (when API key configured)
        String normalizedUrl = uri.normalize().toString();
        if (StringUtils.hasText(safeBrowsingApiKey)) {
            String threat = checkGoogleSafeBrowsing(normalizedUrl);
            if (threat != null) {
                return new UrlSafetyReport(
                        trimmed, normalizedUrl, VERDICT_BLOCKED, 100,
                        List.of("Flagged as malicious by Safe Browsing threat intelligence (" + threat + ")")
                );
            }
        }

        if (riskScore >= 70) {
            return new UrlSafetyReport(trimmed, normalizedUrl, VERDICT_BLOCKED, Math.min(100, riskScore), reasons);
        }
        if (riskScore >= 15) {
            return new UrlSafetyReport(trimmed, normalizedUrl, VERDICT_CAUTION, riskScore, reasons);
        }
        return new UrlSafetyReport(trimmed, normalizedUrl, VERDICT_SAFE, 0, List.of("Passed protocol, phishing heuristic, and anti-SSRF DNS checks"));
    }

    static String checkRestrictedIp(InetAddress addr) {
        if (addr.isAnyLocalAddress()) return "unspecified/0.0.0.0";
        if (addr.isLoopbackAddress()) return "loopback";
        if (addr.isLinkLocalAddress()) return "link-local/metadata";
        if (addr.isSiteLocalAddress()) return "private RFC1918";
        if (addr.isMulticastAddress()) return "multicast";

        byte[] bytes = addr.getAddress();
        if (addr instanceof Inet4Address && bytes.length == 4) {
            int b0 = bytes[0] & 0xFF;
            int b1 = bytes[1] & 0xFF;
            // 0.0.0.0/8
            if (b0 == 0) return "current-network";
            // 100.64.0.0/10 (Carrier-Grade NAT / Tailscale mesh)
            if (b0 == 100 && b1 >= 64 && b1 <= 127) return "CGNAT/mesh private range";
            // 169.254.0.0/16 (Cloud metadata)
            if (b0 == 169 && b1 == 254) return "cloud metadata link-local";
            // 192.0.0.0/24, 192.0.2.0/24, 198.18.0.0/15, 224.0.0.0+
            if (b0 == 198 && (b1 == 18 || b1 == 19)) return "benchmark private range";
            if (b0 >= 224) return "reserved/broadcast";
        } else if (addr instanceof Inet6Address && bytes.length == 16) {
            int b0 = bytes[0] & 0xFF;
            int b1 = bytes[1] & 0xFF;
            // fc00::/7 Unique Local Address (ULA)
            if ((b0 & 0xFE) == 0xFC) return "IPv6 unique-local";
            // fe80::/10 Link-local
            if (b0 == 0xFE && (b1 & 0xC0) == 0x80) return "IPv6 link-local";
        }
        return null;
    }

    private String checkGoogleSafeBrowsing(String url) {
        try {
            String endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + safeBrowsingApiKey;
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("client", Map.of("clientId", "dat-commerce", "clientVersion", "1.0.0"));
            body.put("threatInfo", Map.of(
                    "threatTypes", List.of("MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"),
                    "platformTypes", List.of("ANY_PLATFORM"),
                    "threatEntryTypes", List.of("URL"),
                    "threatEntries", List.of(Map.of("url", url))
            ));
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(4))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> resp = threatClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300 && StringUtils.hasText(resp.body())) {
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode matches = root.path("matches");
                if (matches.isArray() && !matches.isEmpty()) {
                    return matches.get(0).path("threatType").asText("MALICIOUS");
                }
            }
        } catch (Exception ex) {
            log.warn("Optional Safe Browsing lookup failed cleanly: {}", ex.getMessage());
        }
        return null;
    }

    public record UrlSafetyReport(
            String url,
            String normalizedUrl,
            String verdict,
            int riskScore,
            List<String> reasons
    ) {
        public boolean isBlocked() {
            return VERDICT_BLOCKED.equalsIgnoreCase(verdict);
        }
    }
}
