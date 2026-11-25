package com.datcommerce.api.ai;

import com.datcommerce.api.cart.StoreCartController;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/store/ai")
@PreAuthorize("isAuthenticated()")
public class StorefrontAiController {

    private final StorefrontAiService storefrontAiService;
    private final AppProperties appProperties;

    public StorefrontAiController(StorefrontAiService storefrontAiService, AppProperties appProperties) {
        this.storefrontAiService = storefrontAiService;
        this.appProperties = appProperties;
    }

    @GetMapping("/quota")
    public AiDtos.CustomerAiQuotaDto getQuota() {
        return storefrontAiService.getQuota(requireUser());
    }

    @GetMapping("/conversations")
    public List<AiDtos.CustomerConversationSummaryDto> listConversations() {
        return storefrontAiService.listConversations(requireUser());
    }

    @GetMapping("/conversations/{conversationId}")
    public AiDtos.CustomerConversationDetailDto getConversation(@PathVariable UUID conversationId) {
        return storefrontAiService.getConversation(requireUser(), conversationId);
    }

    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<Void> deleteConversation(@PathVariable UUID conversationId) {
        storefrontAiService.deleteConversation(requireUser(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/chat")
    public ResponseEntity<AiDtos.StorefrontChatResponse> chat(
            @Valid @RequestBody AiDtos.StorefrontChatRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String cartSessionToken = StoreCartController.extractSessionToken(request);
        AiDtos.StorefrontChatResponse result = storefrontAiService.chat(
                requireUser(),
                cartSessionToken,
                body
        );
        if (result.updatedCart() != null && StringUtils.hasText(result.updatedCart().sessionToken())) {
            ResponseCookie cookie = ResponseCookie.from(StoreCartController.CART_COOKIE, result.updatedCart().sessionToken())
                    .httpOnly(true)
                    .secure(appProperties.getCookie().isSecure())
                    .sameSite(appProperties.getCookie().getSameSite())
                    .path("/api/v1/store")
                    .maxAge(60L * 60 * 24 * 30)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        }
        return ResponseEntity.ok(result);
    }

    private static AuthenticatedUser requireUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Authentication required");
    }
}
