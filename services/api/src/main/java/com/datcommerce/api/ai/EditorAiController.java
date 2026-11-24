package com.datcommerce.api.ai;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
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

    public EditorAiController(EditorAiService editorAiService) {
        this.editorAiService = editorAiService;
    }

    @PostMapping("/suggest")
    @PreAuthorize("hasAuthority('ai:use') and hasAuthority('content:write')")
    public EditorAiService.EditorSuggestResponse suggest(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody EditorAiService.EditorSuggestRequest request
    ) {
        return editorAiService.suggest(user, request);
    }
}
