import {
  ApiError,
  apiFetch,
  getAccessToken,
  refreshSessionToken,
} from "@/lib/api-client";
import type {
  AdminThemeResponse,
  AnimationPresetDto,
  CreateAnimationPresetRequest,
  GlobalMotionResponse,
  PageAnimationsResponse,
  UpdateAnimationPresetRequest,
  AiActivityDto,
  AiModelSettingsDto,
  EditorSuggestRequest,
  EditorSuggestResponse,
  UrlInspectionResult,
  UpdateAiModelSettingsRequest,
  AiChatTurnResultDto,
  AiChangePlanDto,
  AiConversationDetailDto,
  AiConversationSummaryDto,
  NavigationItemDto,
  NavigationMenuDto,
  PageContentPayload,
  PageDetailDto,
  PageSummaryDto,
  PageVersionDto,
  StorePageResponse,
  ThemeTokens,
  ThemeVersionDto,
} from "@/types/api-cms-ai";

export const cmsStoreApi = {
  getPage: (slug: string) =>
    apiFetch<StorePageResponse>(`/api/v1/store/pages/${encodeURIComponent(slug)}`, {
      skipAuthRefresh: true,
    }),
  getTheme: () =>
    apiFetch<ThemeVersionDto>("/api/v1/store/theme", {
      skipAuthRefresh: true,
    }),
  getNavigation: (menuKey = "main") =>
    apiFetch<NavigationMenuDto>(
      `/api/v1/store/navigation/${encodeURIComponent(menuKey)}`,
      { skipAuthRefresh: true }
    ),
  listAnimationPresets: () =>
    apiFetch<AnimationPresetDto[]>("/api/v1/store/animation-presets", {
      skipAuthRefresh: true,
    }),
};

export const cmsAdminApi = {
  listPages: () => apiFetch<PageSummaryDto[]>("/api/v1/admin/pages"),
  getPage: (pageId: string) =>
    apiFetch<PageDetailDto>(`/api/v1/admin/pages/${pageId}`),
  createPage: (body: {
    slug: string;
    title: string;
    seoTitle?: string;
    seoDescription?: string;
    content?: PageContentPayload;
  }) =>
    apiFetch<PageDetailDto>("/api/v1/admin/pages", { method: "POST", body }),
  createPageVersion: (
    pageId: string,
    body: {
      content: PageContentPayload;
      changeSummary?: string;
      title?: string;
      seoTitle?: string;
      seoDescription?: string;
      expectedVersion?: number;
    }
  ) =>
    apiFetch<PageDetailDto>(`/api/v1/admin/pages/${pageId}/versions`, {
      method: "POST",
      body,
    }),
  previewPage: (pageId: string) =>
    apiFetch<PageVersionDto>(`/api/v1/admin/pages/${pageId}/preview`, {
      method: "POST",
    }),
  publishPage: (
    pageId: string,
    body?: { versionId?: string; expectedVersion?: number }
  ) =>
    apiFetch<PageDetailDto>(`/api/v1/admin/pages/${pageId}/publish`, {
      method: "POST",
      body: body || {},
    }),
  rollbackPage: (pageId: string, versionId: string) =>
    apiFetch<PageDetailDto>(
      `/api/v1/admin/pages/${pageId}/rollback/${versionId}`,
      { method: "POST" }
    ),

  getTheme: () => apiFetch<AdminThemeResponse>("/api/v1/admin/theme"),
  createThemeVersion: (tokens: ThemeTokens, note?: string) =>
    apiFetch<ThemeVersionDto>("/api/v1/admin/theme/versions", {
      method: "POST",
      body: { tokens, note },
    }),
  publishTheme: (versionId?: string) =>
    apiFetch<ThemeVersionDto>("/api/v1/admin/theme/publish", {
      method: "POST",
      body: versionId ? { versionId } : {},
    }),
  rollbackTheme: (versionId: string) =>
    apiFetch<ThemeVersionDto>(`/api/v1/admin/theme/rollback/${versionId}`, {
      method: "POST",
    }),

  getNavigation: (menuKey = "main") =>
    apiFetch<NavigationMenuDto>(
      `/api/v1/admin/navigation/${encodeURIComponent(menuKey)}`
    ),
  updateNavigation: (menuKey: string, items: NavigationItemDto[]) =>
    apiFetch<NavigationMenuDto>(
      `/api/v1/admin/navigation/${encodeURIComponent(menuKey)}`,
      { method: "PUT", body: { items } }
    ),

  listAnimationPresets: (category?: string) =>
    apiFetch<AnimationPresetDto[]>(
      category
        ? `/api/v1/admin/animation-presets?category=${encodeURIComponent(category)}`
        : "/api/v1/admin/animation-presets"
    ),
  createAnimationPreset: (body: CreateAnimationPresetRequest) =>
    apiFetch<AnimationPresetDto>("/api/v1/admin/animation-presets", {
      method: "POST",
      body,
    }),
  updateAnimationPreset: (presetId: string, body: UpdateAnimationPresetRequest) =>
    apiFetch<AnimationPresetDto>(`/api/v1/admin/animation-presets/${presetId}`, {
      method: "PUT",
      body,
    }),
  deleteAnimationPreset: (presetId: string) =>
    apiFetch<void>(`/api/v1/admin/animation-presets/${presetId}`, {
      method: "DELETE",
    }),
  getPageAnimations: (pageId: string) =>
    apiFetch<PageAnimationsResponse>(`/api/v1/admin/pages/${pageId}/animations`),
  putElementAnimation: (
    pageId: string,
    elementId: string,
    body: { motion: unknown; expectedVersion?: number; changeSummary?: string }
  ) =>
    apiFetch<PageDetailDto>(
      `/api/v1/admin/pages/${pageId}/elements/${encodeURIComponent(elementId)}/animation`,
      { method: "PUT", body }
    ),
  deleteElementAnimation: (
    pageId: string,
    elementId: string,
    expectedVersion?: number
  ) =>
    apiFetch<PageDetailDto>(
      expectedVersion !== undefined
        ? `/api/v1/admin/pages/${pageId}/elements/${encodeURIComponent(elementId)}/animation?expectedVersion=${expectedVersion}`
        : `/api/v1/admin/pages/${pageId}/elements/${encodeURIComponent(elementId)}/animation`,
      { method: "DELETE" }
    ),
  getGlobalMotionSettings: () =>
    apiFetch<GlobalMotionResponse>("/api/v1/admin/theme/motion-settings"),
  updateGlobalMotionSettings: (motion: unknown, note?: string) =>
    apiFetch<ThemeVersionDto>("/api/v1/admin/theme/motion-settings", {
      method: "PUT",
      body: { motion, note },
    }),
};

export type AiSseHandlers = {
  onStatus?: (data: { phase: string; message: string }) => void;
  onToolStarted?: (data: { tool: string; callId: string }) => void;
  onToolCompleted?: (data: { toolCall: unknown; status: string }) => void;
  onPlanCreated?: (data: AiChangePlanDto) => void;
  onMessageDelta?: (data: { text: string }) => void;
  onCompleted?: (data: AiChatTurnResultDto) => void;
  onError?: (message: string) => void;
};

async function openSseResponse(
  url: string,
  payload: unknown,
  retry = true
): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (res.status === 401 && retry) {
    const refreshed = await refreshSessionToken();
    if (refreshed?.accessToken) {
      return openSseResponse(url, payload, false);
    }
  }
  if (!res.ok) {
    const msg = res.statusText || `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { message?: string; code?: string };
      throw new ApiError(
        res.status,
        errBody.code || `HTTP_${res.status}`,
        errBody.message || msg
      );
    } catch (ex) {
      if (ex instanceof ApiError) throw ex;
      throw new ApiError(res.status, `HTTP_${res.status}`, msg);
    }
  }
  return res;
}

export const aiAdminApi = {
  listConversations: () =>
    apiFetch<AiConversationSummaryDto[]>("/api/v1/admin/ai/conversations"),
  createConversation: (title?: string, model?: string) =>
    apiFetch<AiConversationSummaryDto>("/api/v1/admin/ai/conversations", {
      method: "POST",
      body: { title, model },
    }),
  getConversation: (conversationId: string) =>
    apiFetch<AiConversationDetailDto>(
      `/api/v1/admin/ai/conversations/${conversationId}`
    ),
  deleteConversation: (conversationId: string) =>
    apiFetch<void>(`/api/v1/admin/ai/conversations/${conversationId}`, {
      method: "DELETE",
    }),
  sendMessageSync: (
    conversationId: string,
    body: { prompt: string; model?: string; context?: Record<string, unknown> }
  ) =>
    apiFetch<AiChatTurnResultDto>(
      `/api/v1/admin/ai/conversations/${conversationId}/messages`,
      { method: "POST", body }
    ),
  streamMessage: async (
    conversationId: string,
    body: { prompt: string; model?: string; context?: Record<string, unknown> },
    handlers: AiSseHandlers
  ): Promise<void> => {
    const response = await openSseResponse(
      `/api/v1/admin/ai/conversations/${conversationId}/messages`,
      body
    );
    if (!response.body) {
      throw new ApiError(500, "STREAM_UNAVAILABLE", "No stream body returned");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const dispatchBlock = (rawBlock: string) => {
      if (!rawBlock.trim()) return;
      let eventName = "message";
      const dataLines: string[] = [];
      for (const line of rawBlock.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trim());
        }
      }
      if (!dataLines.length) return;
      const rawData = dataLines.join("\n");
      let parsed: unknown = rawData;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        // Keep string
      }
      switch (eventName) {
        case "status":
          handlers.onStatus?.(parsed as { phase: string; message: string });
          break;
        case "tool.started":
          handlers.onToolStarted?.(parsed as { tool: string; callId: string });
          break;
        case "tool.completed":
          handlers.onToolCompleted?.(parsed as { toolCall: unknown; status: string });
          break;
        case "plan.created":
          handlers.onPlanCreated?.(parsed as AiChangePlanDto);
          break;
        case "message.delta":
          handlers.onMessageDelta?.(parsed as { text: string });
          break;
        case "operation.completed":
          handlers.onCompleted?.(parsed as AiChatTurnResultDto);
          break;
        case "error":
          handlers.onError?.(
            typeof parsed === "object" && parsed && "message" in parsed
              ? String((parsed as { message: string }).message)
              : "AI stream error"
          );
          break;
        default:
          break;
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() || "";
      for (const part of parts) {
        dispatchBlock(part);
      }
    }
    if (buffer.trim()) {
      dispatchBlock(buffer);
    }
  },
  listChangePlans: () =>
    apiFetch<AiChangePlanDto[]>("/api/v1/admin/ai/change-plans"),
  applyChangePlan: (planId: string, idempotencyKey: string) =>
    apiFetch<AiChangePlanDto>(`/api/v1/admin/ai/change-plans/${planId}/apply`, {
      method: "POST",
      idempotencyKey,
    }),
  rejectChangePlan: (planId: string, reason?: string) =>
    apiFetch<AiChangePlanDto>(`/api/v1/admin/ai/change-plans/${planId}/reject`, {
      method: "POST",
      body: reason ? { reason } : {},
    }),
  rollbackChangePlan: (planId: string) =>
    apiFetch<AiChangePlanDto>(
      `/api/v1/admin/ai/change-plans/${planId}/rollback`,
      { method: "POST" }
    ),
  getActivity: () => apiFetch<AiActivityDto>("/api/v1/admin/ai/activity"),
  getSettings: () => apiFetch<AiModelSettingsDto>("/api/v1/admin/ai/settings"),
  updateSettings: (body: UpdateAiModelSettingsRequest) =>
    apiFetch<AiModelSettingsDto>("/api/v1/admin/ai/settings", {
      method: "PUT",
      body,
    }),
  suggestEditorChanges: (body: EditorSuggestRequest) =>
    apiFetch<EditorSuggestResponse>("/api/v1/admin/ai/editor/suggest", {
      method: "POST",
      body,
    }),
  inspectReferenceUrl: (url: string) =>
    apiFetch<UrlInspectionResult>("/api/v1/admin/ai/editor/inspect-reference-url", {
      method: "POST",
      body: { url },
    }),
};
