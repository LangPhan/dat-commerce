package com.datcommerce.api.ai;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/ai/editor")
public class EditorAiController {

    private final EditorAiService editorAiService;
    private final WebsiteDesignInspectorService websiteDesignInspectorService;

    public EditorAiController(
            EditorAiService editorAiService,
            WebsiteDesignInspectorService websiteDesignInspectorService
    ) {
        this.editorAiService = editorAiService;
        this.websiteDesignInspectorService = websiteDesignInspectorService;
    }

    @PostMapping("/suggest")
    @PreAuthorize("hasAuthority('ai:use') and hasAuthority('content:write')")
    public EditorAiService.EditorSuggestResponse suggest(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody EditorAiService.EditorSuggestRequest request
    ) {
        return editorAiService.suggest(user, request);
    }

    @PostMapping("/inspect-reference-url")
    @PreAuthorize("hasAuthority('ai:use') and hasAuthority('content:write')")
    public WebsiteDesignInspectorService.UrlInspectionResult inspectReferenceUrl(
            @Valid @RequestBody InspectUrlRequest request
    ) {
        return websiteDesignInspectorService.inspect(request.url());
    }

    public record InspectUrlRequest(
            @NotBlank @Size(max = 2048) String url
    ) {
    }
}
