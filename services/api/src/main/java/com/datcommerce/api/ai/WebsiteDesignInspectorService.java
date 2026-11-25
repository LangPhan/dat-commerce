package com.datcommerce.api.ai;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class WebsiteDesignInspectorService {

    private static final int MAX_REDIRECT_HOPS = 3;
    private static final int MAX_BODY_BYTES = 1_500_000;

    private static final Pattern HEX_COLOR = Pattern.compile("#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b");
    private static final Pattern FONT_FAMILY_CSS = Pattern.compile("(?i)font-family\\s*:\\s*([^;}{\\n]{2,80})");
    private static final Pattern GOOGLE_FONTS_PARAM = Pattern.compile("(?i)family=([A-Za-z0-9+%\\-]+)");
    private static final Pattern PROMPT_INJECTION = Pattern.compile(
            "(?i)(ignore\\s+(all\\s+)?previous\\s+instructions|system\\s+prompt|developer\\s+message|you\\s+are\\s+now\\s+|jailbreak|execute\\s+sql|<script)"
    );
    private static final Pattern META_REFRESH_URL = Pattern.compile("(?i)url\\s*=\\s*['\"]?([^'\"\\s;]+)");

    private final ReferenceUrlSafetyService safetyService;
    private final HttpClient httpClient;

    public WebsiteDesignInspectorService(ReferenceUrlSafetyService safetyService) {
        this.safetyService = safetyService;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public UrlInspectionResult inspect(String rawUrl) {
        ReferenceUrlSafetyService.UrlSafetyReport initial = safetyService.assess(rawUrl);
        if (initial.isBlocked()) {
            return new UrlInspectionResult(initial, null);
        }

        String currentUrl = initial.normalizedUrl();
        ReferenceUrlSafetyService.UrlSafetyReport latestReport = initial;

        try {
            for (int hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(currentUrl))
                        .timeout(Duration.ofSeconds(8))
                        .header("User-Agent", "DatCommerceDesignInspector/1.0 (+https://datcommerce.local)")
                        .header("Accept", "text/html,application/xhtml+xml;q=0.9")
                        .GET()
                        .build();

                HttpResponse<InputStream> response = httpClient.send(req, HttpResponse.BodyHandlers.ofInputStream());
                int status = response.statusCode();

                if (status >= 300 && status < 400) {
                    closeQuietly(response.body());
                    if (hop == MAX_REDIRECT_HOPS) {
                        return new UrlInspectionResult(
                                new ReferenceUrlSafetyService.UrlSafetyReport(
                                        rawUrl, currentUrl, ReferenceUrlSafetyService.VERDICT_BLOCKED, 85,
                                        List.of("Blocked excessive redirect chain (> " + MAX_REDIRECT_HOPS + " hops)")
                                ),
                                null
                        );
                    }
                    String location = response.headers().firstValue("location").orElse("");
                    if (!StringUtils.hasText(location)) {
                        return new UrlInspectionResult(
                                new ReferenceUrlSafetyService.UrlSafetyReport(
                                        rawUrl, currentUrl, ReferenceUrlSafetyService.VERDICT_BLOCKED, 80,
                                        List.of("Redirect missing target location")
                                ),
                                null
                        );
                    }
                    URI nextUri = URI.create(currentUrl).resolve(location.trim());
                    ReferenceUrlSafetyService.UrlSafetyReport hopReport = safetyService.assess(nextUri.toString());
                    if (hopReport.isBlocked()) {
                        return new UrlInspectionResult(
                                new ReferenceUrlSafetyService.UrlSafetyReport(
                                        rawUrl, nextUri.toString(), ReferenceUrlSafetyService.VERDICT_BLOCKED, 100,
                                        List.of("Redirect target blocked for security: " + String.join("; ", hopReport.reasons()))
                                ),
                                null
                        );
                    }
                    latestReport = hopReport;
                    currentUrl = hopReport.normalizedUrl();
                    continue;
                }

                if (status < 200 || status >= 300) {
                    closeQuietly(response.body());
                    return new UrlInspectionResult(
                            new ReferenceUrlSafetyService.UrlSafetyReport(
                                    rawUrl, currentUrl, ReferenceUrlSafetyService.VERDICT_CAUTION, 40,
                                    List.of("Website returned HTTP " + status + "; visual HTML could not be inspected")
                            ),
                            null
                    );
                }

                String contentType = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
                if (!contentType.contains("text/html") && !contentType.contains("application/xhtml+xml")) {
                    closeQuietly(response.body());
                    return new UrlInspectionResult(
                            new ReferenceUrlSafetyService.UrlSafetyReport(
                                    rawUrl, currentUrl, ReferenceUrlSafetyService.VERDICT_BLOCKED, 90,
                                    List.of("Blocked non-HTML response content-type: " + (contentType.isEmpty() ? "unknown" : contentType))
                            ),
                            null
                    );
                }

                String html = readBoundedUtf8(response.body(), MAX_BODY_BYTES);
                return parseAndExtractDesignDna(rawUrl, currentUrl, html, latestReport);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new UrlInspectionResult(
                    new ReferenceUrlSafetyService.UrlSafetyReport(
                            rawUrl, currentUrl, ReferenceUrlSafetyService.VERDICT_CAUTION, 45,
                            List.of("Website inspection was interrupted")
                    ),
                    null
            );
        } catch (Exception ex) {
            return new UrlInspectionResult(
                    new ReferenceUrlSafetyService.UrlSafetyReport(
                            rawUrl, currentUrl, ReferenceUrlSafetyService.VERDICT_CAUTION, 45,
                            List.of("Could not fetch website HTML safely: " + ex.getMessage())
                    ),
                    null
            );
        }

        return new UrlInspectionResult(latestReport, null);
    }

    UrlInspectionResult parseAndExtractDesignDna(
            String rawUrl,
            String finalUrl,
            String html,
            ReferenceUrlSafetyService.UrlSafetyReport safetyReport
    ) {
        Document doc = Jsoup.parse(html != null ? html : "", finalUrl);

        // Scan for malicious meta-refresh to unsafe target
        for (Element meta : doc.select("meta[http-equiv~=(?i)refresh]")) {
            String content = meta.attr("content");
            Matcher m = META_REFRESH_URL.matcher(content);
            if (m.find()) {
                String target = m.group(1);
                try {
                    URI resolved = URI.create(finalUrl).resolve(target);
                    ReferenceUrlSafetyService.UrlSafetyReport refreshCheck = safetyService.assess(resolved.toString());
                    if (refreshCheck.isBlocked()) {
                        return new UrlInspectionResult(
                                new ReferenceUrlSafetyService.UrlSafetyReport(
                                        rawUrl, finalUrl, ReferenceUrlSafetyService.VERDICT_BLOCKED, 100,
                                        List.of("Page contains malicious meta-refresh redirect: " + String.join("; ", refreshCheck.reasons()))
                                ),
                                null
                        );
                    }
                } catch (Exception ignored) {
                    // ignore malformed meta refresh
                }
            }
        }

        // Heuristic phishing credential form check: hidden password form posting to external host
        String pageHost = safeHost(finalUrl);
        for (Element form : doc.select("form")) {
            if (!form.select("input[type=password]").isEmpty()) {
                String action = form.attr("action").trim();
                if (action.startsWith("http://") || action.startsWith("https://")) {
                    String actionHost = safeHost(action);
                    if (StringUtils.hasText(actionHost) && !actionHost.equalsIgnoreCase(pageHost)) {
                        return new UrlInspectionResult(
                                new ReferenceUrlSafetyService.UrlSafetyReport(
                                        rawUrl, finalUrl, ReferenceUrlSafetyService.VERDICT_BLOCKED, 98,
                                        List.of("Blocked suspected credential-phishing page (password form posts to external domain " + actionHost + ")")
                                ),
                                null
                        );
                    }
                }
            }
        }

        // Collect CSS colors & font hints BEFORE stripping <style>/<link>
        Set<String> palette = new LinkedHashSet<>();
        Set<String> fonts = new LinkedHashSet<>();

        for (Element link : doc.select("link[href*=fonts.googleapis.com]")) {
            Matcher fm = GOOGLE_FONTS_PARAM.matcher(link.attr("href"));
            while (fm.find() && fonts.size() < 6) {
                String name = fm.group(1).replace("+", " ").replace("%20", " ").split(":")[0].trim();
                if (StringUtils.hasText(name)) fonts.add(name);
            }
        }

        StringBuilder styleCorpus = new StringBuilder();
        for (Element st : doc.select("style")) {
            if (styleCorpus.length() < 40_000) {
                styleCorpus.append(st.data()).append('\n');
            }
        }
        for (Element el : doc.select("[style]")) {
            if (styleCorpus.length() < 50_000) {
                styleCorpus.append(el.attr("style")).append('\n');
            }
        }

        Matcher cm = HEX_COLOR.matcher(styleCorpus.toString());
        while (cm.find() && palette.size() < 12) {
            palette.add(cm.group().toUpperCase(Locale.ROOT));
        }

        Matcher ff = FONT_FAMILY_CSS.matcher(styleCorpus.toString());
        while (ff.find() && fonts.size() < 8) {
            String first = ff.group(1).split(",")[0].replace("\"", "").replace("'", "").trim();
            if (StringUtils.hasText(first)
                    && !first.equalsIgnoreCase("inherit")
                    && !first.equalsIgnoreCase("sans-serif")
                    && !first.equalsIgnoreCase("serif")
                    && !first.equalsIgnoreCase("monospace")
                    && first.length() <= 40) {
                fonts.add(first);
            }
        }

        String themeColor = doc.select("meta[name=theme-color]").attr("content").trim();
        if (HEX_COLOR.matcher(themeColor).matches()) {
            palette.add(themeColor.toUpperCase(Locale.ROOT));
        }

        // Strip all executable / active / dangerous elements before extracting semantic layout structure
        doc.select("script, noscript, iframe, object, embed, applet, style, svg, form[action^=javascript]").remove();

        String title = sanitizeText(doc.title(), 120);
        String description = sanitizeText(doc.select("meta[name=description]").attr("content"), 220);
        String ogImage = doc.select("meta[property=og:image]").attr("abs:content").trim();
        if (!ogImage.startsWith("https://") && !ogImage.startsWith("http://")) {
            ogImage = "";
        }

        List<Map<String, Object>> sectionOutline = new ArrayList<>();
        Elements landmarks = doc.select("header, main > section, main > div, section, article, footer");
        if (landmarks.isEmpty()) {
            landmarks = doc.select("body > div");
        }
        int secIdx = 0;
        for (Element sec : landmarks) {
            if (secIdx >= 10) break;
            String tag = sec.tagName().toLowerCase(Locale.ROOT);
            String heading = sanitizeText(sec.select("h1, h2, h3").stream().findFirst().map(Element::text).orElse(""), 90);
            int imgCount = sec.select("img").size();
            int btnCount = sec.select("a, button").size();
            if (!StringUtils.hasText(heading) && imgCount == 0 && btnCount < 2 && !"header".equals(tag) && !"footer".equals(tag)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("role", tag);
            if (StringUtils.hasText(heading)) row.put("heading", heading);
            row.put("imageCount", imgCount);
            row.put("actionCount", Math.min(btnCount, 20));
            List<String> ctaLabels = sec.select("button, a[class*=btn], a[class*=cta], a[class*=button]")
                    .stream()
                    .map(e -> sanitizeText(e.text(), 36))
                    .filter(StringUtils::hasText)
                    .distinct()
                    .limit(3)
                    .toList();
            if (!ctaLabels.isEmpty()) row.put("ctas", ctaLabels);
            sectionOutline.add(row);
            secIdx++;
        }

        List<String> layoutHints = new ArrayList<>();
        String htmlLower = styleCorpus.toString().toLowerCase(Locale.ROOT);
        if (htmlLower.contains("display:grid") || htmlLower.contains("display: grid")) {
            layoutHints.add("Uses CSS Grid card sections");
        }
        if (htmlLower.contains("display:flex") || htmlLower.contains("display: flex")) {
            layoutHints.add("Uses Flexbox split layouts");
        }
        if (htmlLower.contains("border-radius")) {
            layoutHints.add("Rounded surfaces / soft corners");
        }
        if (htmlLower.contains("linear-gradient") || htmlLower.contains("radial-gradient")) {
            layoutHints.add("Gradient hero or accent surfaces");
        }
        if (doc.select("h1").size() > 0) {
            layoutHints.add("Primary H1 hero focal point: \"" + sanitizeText(doc.select("h1").first().text(), 60) + "\"");
        }

        WebsiteDesignDna dna = new WebsiteDesignDna(
                finalUrl,
                title,
                description,
                ogImage,
                List.copyOf(palette),
                List.copyOf(fonts),
                sectionOutline,
                layoutHints
        );
        return new UrlInspectionResult(safetyReport, dna);
    }

    private static String sanitizeText(String raw, int maxLen) {
        if (!StringUtils.hasText(raw)) return "";
        String cleaned = raw.replaceAll("\\s+", " ").trim();
        if (PROMPT_INJECTION.matcher(cleaned).find()) {
            cleaned = PROMPT_INJECTION.matcher(cleaned).replaceAll("[filtered]");
        }
        return cleaned.length() <= maxLen ? cleaned : cleaned.substring(0, maxLen - 1) + "…";
    }

    private static String safeHost(String url) {
        try {
            String h = URI.create(url).getHost();
            return h != null ? h.toLowerCase(Locale.ROOT) : "";
        } catch (Exception ex) {
            return "";
        }
    }

    private static String readBoundedUtf8(InputStream in, int maxBytes) throws Exception {
        try (InputStream is = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int total = 0;
            int read;
            while ((read = is.read(buf)) != -1) {
                int remaining = maxBytes - total;
                if (remaining <= 0) break;
                int toWrite = Math.min(read, remaining);
                out.write(buf, 0, toWrite);
                total += toWrite;
            }
            return out.toString(StandardCharsets.UTF_8);
        }
    }

    private static void closeQuietly(InputStream is) {
        if (is != null) {
            try {
                is.close();
            } catch (Exception ignored) {
            }
        }
    }

    public record WebsiteDesignDna(
            String url,
            String title,
            String description,
            String ogImage,
            List<String> paletteColors,
            List<String> fontFamilies,
            List<Map<String, Object>> sectionOutline,
            List<String> layoutHints
    ) {
    }

    public record UrlInspectionResult(
            ReferenceUrlSafetyService.UrlSafetyReport safety,
            WebsiteDesignDna designDna
    ) {
    }
}
