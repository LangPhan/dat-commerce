package com.datcommerce.api.ai;

import com.datcommerce.api.common.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/admin/ai")
public class AiAdminController {

    private final AiOrchestratorService orchestratorService;
    private final AiChangePlanService changePlanService;
    private final AiSettingsService settingsService;
    private final AiTokenQuotaService quotaService;

    public AiAdminController(
            AiOrchestratorService orchestratorService,
            AiChangePlanService changePlanService,
            AiSettingsService settingsService
    ) {
        this(orchestratorService, changePlanService, settingsService, null);
    }

    @Autowired
    public AiAdminController(
            AiOrchestratorService orchestratorService,
            AiChangePlanService changePlanService,
            AiSettingsService settingsService,
            AiTokenQuotaService quotaService
    ) {
        this.orchestratorService = orchestratorService;
        this.changePlanService = changePlanService;
        this.settingsService = settingsService;
        this.quotaService = quotaService;
    }

    @GetMapping("/settings")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.AiModelSettingsDto getSettings(@AuthenticationPrincipal AuthenticatedUser user) {
        return settingsService.getSettings(user.storeId());
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.AiModelSettingsDto updateSettings(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody AiDtos.UpdateAiModelSettingsRequest request
    ) {
        return settingsService.updateSettings(user, request);
    }

    @GetMapping("/conversations")
    @PreAuthorize("hasAuthority('ai:use')")
    public List<AiDtos.ConversationSummaryDto> listConversations(@AuthenticationPrincipal AuthenticatedUser user) {
        return orchestratorService.listConversations(user);
    }

    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.ConversationSummaryDto createConversation(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody(required = false) AiDtos.CreateConversationRequest request
    ) {
        return orchestratorService.createConversation(user, request);
    }

    @GetMapping("/conversations/{conversationId}")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.ConversationDetailDto getConversation(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID conversationId
    ) {
        return orchestratorService.getConversation(user, conversationId);
    }

    @DeleteMapping("/conversations/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('ai:use')")
    public void deleteConversation(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID conversationId
    ) {
        orchestratorService.deleteConversation(user, conversationId);
    }

    @PostMapping(
            value = "/conversations/{conversationId}/messages",
            headers = "Accept=text/event-stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    @PreAuthorize("hasAuthority('ai:use')")
    public SseEmitter streamMessage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID conversationId,
            @Valid @RequestBody AiDtos.SendMessageRequest request
    ) {
        return orchestratorService.streamMessage(user, conversationId, request);
    }

    @PostMapping(
            value = "/conversations/{conversationId}/messages",
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.ChatTurnResultDto sendMessage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID conversationId,
            @Valid @RequestBody AiDtos.SendMessageRequest request
    ) {
        return orchestratorService.sendMessageSync(user, conversationId, request);
    }

    @GetMapping("/change-plans")
    @PreAuthorize("hasAuthority('ai:use')")
    public List<AiDtos.ChangePlanDto> listChangePlans(@AuthenticationPrincipal AuthenticatedUser user) {
        return changePlanService.listPlans(user.storeId());
    }

    @GetMapping("/change-plans/{planId}")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.ChangePlanDto getChangePlan(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID planId
    ) {
        return changePlanService.getPlan(user.storeId(), planId);
    }

    @PostMapping("/change-plans/{planId}/apply")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.ChangePlanDto applyPlan(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID planId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        return changePlanService.applyPlan(user, planId, idempotencyKey);
    }

    @PostMapping("/change-plans/{planId}/reject")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.ChangePlanDto rejectPlan(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID planId,
            @Valid @RequestBody(required = false) AiDtos.RejectPlanRequest request
    ) {
        return changePlanService.rejectPlan(user, planId, request == null ? null : request.reason());
    }

    @PostMapping("/change-plans/{planId}/rollback")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.ChangePlanDto rollbackPlan(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID planId
    ) {
        return changePlanService.rollbackPlan(user, planId);
    }

    @GetMapping("/activity")
    @PreAuthorize("hasAuthority('ai:use')")
    public AiDtos.AiActivityDto getActivity(@AuthenticationPrincipal AuthenticatedUser user) {
        return orchestratorService.getActivity(user.storeId());
    }

    @GetMapping("/customer-usage")
    @PreAuthorize("hasAuthority('ai:use')")
    public List<AiDtos.AdminCustomerUsageRowDto> getCustomerUsage(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return quotaService != null ? quotaService.listTodayUsage(user.storeId()) : List.of();
    }

    @PostMapping("/customer-usage/{targetUserId}/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('store:write')")
    public void resetCustomerUsage(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID targetUserId
    ) {
        if (quotaService != null) {
            quotaService.resetUserTodayUsage(user, targetUserId);
        }
    }
}
