package com.datcommerce.api.common.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Cookie cookie = new Cookie();
    private Seed seed = new Seed();
    private Cors cors = new Cors();
    private Storage storage = new Storage();
    private Ai ai = new Ai();
    private Auth auth = new Auth();

    public Auth getAuth() {
        return auth;
    }

    public void setAuth(Auth auth) {
        this.auth = auth;
    }

    public Jwt getJwt() {
        return jwt;
    }

    public void setJwt(Jwt jwt) {
        this.jwt = jwt;
    }

    public Cookie getCookie() {
        return cookie;
    }

    public void setCookie(Cookie cookie) {
        this.cookie = cookie;
    }

    public Seed getSeed() {
        return seed;
    }

    public void setSeed(Seed seed) {
        this.seed = seed;
    }

    public Cors getCors() {
        return cors;
    }

    public void setCors(Cors cors) {
        this.cors = cors;
    }

    public Storage getStorage() {
        return storage;
    }

    public void setStorage(Storage storage) {
        this.storage = storage;
    }

    public Ai getAi() {
        return ai;
    }

    public void setAi(Ai ai) {
        this.ai = ai;
    }

    public static class Jwt {
        private String secret;
        private long accessTtlSeconds = 900;
        private long refreshTtlSeconds = 604800;

        public String getSecret() {
            return secret;
        }

        public void setSecret(String secret) {
            this.secret = secret;
        }

        public long getAccessTtlSeconds() {
            return accessTtlSeconds;
        }

        public void setAccessTtlSeconds(long accessTtlSeconds) {
            this.accessTtlSeconds = accessTtlSeconds;
        }

        public long getRefreshTtlSeconds() {
            return refreshTtlSeconds;
        }

        public void setRefreshTtlSeconds(long refreshTtlSeconds) {
            this.refreshTtlSeconds = refreshTtlSeconds;
        }
    }

    public static class Cookie {
        private String name = "dc_refresh_token";
        private boolean secure = false;
        private String sameSite = "Lax";

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public boolean isSecure() {
            return secure;
        }

        public void setSecure(boolean secure) {
            this.secure = secure;
        }

        public String getSameSite() {
            return sameSite;
        }

        public void setSameSite(String sameSite) {
            this.sameSite = sameSite;
        }
    }

    public static class Seed {
        private boolean enabled = false;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }

    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:3000", "http://localhost:8088");

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }

    public static class Storage {
        private String endpoint = "http://localhost:9000";
        private String accessKey = "datcommerce";
        private String secretKey = "change_me_silo_password";
        private String bucket = "dat-commerce-media";
        private String region = "us-east-1";
        private String publicUrlPrefix = "/storage";

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public String getAccessKey() {
            return accessKey;
        }

        public void setAccessKey(String accessKey) {
            this.accessKey = accessKey;
        }

        public String getSecretKey() {
            return secretKey;
        }

        public void setSecretKey(String secretKey) {
            this.secretKey = secretKey;
        }

        public String getBucket() {
            return bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getRegion() {
            return region;
        }

        public void setRegion(String region) {
            this.region = region;
        }

        public String getPublicUrlPrefix() {
            return publicUrlPrefix;
        }

        public void setPublicUrlPrefix(String publicUrlPrefix) {
            this.publicUrlPrefix = publicUrlPrefix;
        }
    }

    public static class Ai {
        private String gatewayMode = "mock";
        private String baseUrl = "";
        private String apiKey = "";
        private String defaultModel = "claude-sonnet-4";
        private String complexTaskModel = "claude-sonnet-4";
        private String fastTaskModel = "forma-fast";
        private int requestTimeoutSeconds = 45;
        private int maxToolRounds = 6;
        private int maxInputTokens = 16000;
        private int maxOutputTokens = 4096;
        private long dailyTokenBudget = 2_000_000L;
        private int retryMaxAttempts = 3;
        private int circuitBreakerThreshold = 5;
        private int circuitBreakerOpenSeconds = 30;

        public String getGatewayMode() {
            return gatewayMode;
        }

        public void setGatewayMode(String gatewayMode) {
            this.gatewayMode = gatewayMode;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getDefaultModel() {
            return defaultModel;
        }

        public void setDefaultModel(String defaultModel) {
            this.defaultModel = defaultModel;
        }

        public String getComplexTaskModel() {
            return complexTaskModel;
        }

        public void setComplexTaskModel(String complexTaskModel) {
            this.complexTaskModel = complexTaskModel;
        }

        public String getFastTaskModel() {
            return fastTaskModel;
        }

        public void setFastTaskModel(String fastTaskModel) {
            this.fastTaskModel = fastTaskModel;
        }

        public int getRequestTimeoutSeconds() {
            return requestTimeoutSeconds;
        }

        public void setRequestTimeoutSeconds(int requestTimeoutSeconds) {
            this.requestTimeoutSeconds = requestTimeoutSeconds;
        }

        public int getMaxToolRounds() {
            return maxToolRounds;
        }

        public void setMaxToolRounds(int maxToolRounds) {
            this.maxToolRounds = maxToolRounds;
        }

        public int getMaxInputTokens() {
            return maxInputTokens;
        }

        public void setMaxInputTokens(int maxInputTokens) {
            this.maxInputTokens = maxInputTokens;
        }

        public int getMaxOutputTokens() {
            return maxOutputTokens;
        }

        public void setMaxOutputTokens(int maxOutputTokens) {
            this.maxOutputTokens = maxOutputTokens;
        }

        public long getDailyTokenBudget() {
            return dailyTokenBudget;
        }

        public void setDailyTokenBudget(long dailyTokenBudget) {
            this.dailyTokenBudget = dailyTokenBudget;
        }

        public int getRetryMaxAttempts() {
            return retryMaxAttempts;
        }

        public void setRetryMaxAttempts(int retryMaxAttempts) {
            this.retryMaxAttempts = retryMaxAttempts;
        }

        public int getCircuitBreakerThreshold() {
            return circuitBreakerThreshold;
        }

        public void setCircuitBreakerThreshold(int circuitBreakerThreshold) {
            this.circuitBreakerThreshold = circuitBreakerThreshold;
        }

        public int getCircuitBreakerOpenSeconds() {
            return circuitBreakerOpenSeconds;
        }

        public void setCircuitBreakerOpenSeconds(int circuitBreakerOpenSeconds) {
            this.circuitBreakerOpenSeconds = circuitBreakerOpenSeconds;
        }
    }

    public static class Auth {
        private int loginMaxFailures = 10;
        private int loginWindowSeconds = 300;

        public int getLoginMaxFailures() {
            return loginMaxFailures;
        }

        public void setLoginMaxFailures(int loginMaxFailures) {
            this.loginMaxFailures = loginMaxFailures;
        }

        public int getLoginWindowSeconds() {
            return loginWindowSeconds;
        }

        public void setLoginWindowSeconds(int loginWindowSeconds) {
            this.loginWindowSeconds = loginWindowSeconds;
        }
    }
}
