import { apiFetch } from "@/lib/api-client";
import type {
  ActivationMode,
  ConflictStrategy,
  ExperienceAiChatTurn,
  ExperienceAiDesignResponse,
  ExperienceBlendMode,
  ExperienceCategory,
  ExperienceDetailDto,
  ExperienceSettingsDto,
  ExperienceSummaryDto,
  ExperienceTemplateDto,
  FallbackBehavior,
  MobilePerformanceMode,
  RecurrenceRule,
  ResolvedStorefrontExperienceDto,
  SeasonalExperienceConfig,
} from "./types";

export const experienceStoreApi = {
  getActive: (route?: string) => {
    const qs = route ? `?route=${encodeURIComponent(route)}` : "";
    return apiFetch<ResolvedStorefrontExperienceDto>(
      `/api/v1/store/experiences/active${qs}`,
      { skipAuthRefresh: true }
    );
  },
};

export const experienceAdminApi = {
  listTemplates: () =>
    apiFetch<ExperienceTemplateDto[]>("/api/v1/admin/experiences/templates"),
  list: () =>
    apiFetch<ExperienceSummaryDto[]>("/api/v1/admin/experiences"),
  get: (id: string) =>
    apiFetch<ExperienceDetailDto>(`/api/v1/admin/experiences/${id}`),
  create: (body: {
    name: string;
    slug?: string;
    description?: string;
    category?: ExperienceCategory | string;
    presetKey?: string;
    activationMode?: ActivationMode;
    startsAt?: string | null;
    endsAt?: string | null;
    timezone?: string;
    recurrenceRule?: RecurrenceRule;
    priority?: number;
    blendMode?: ExperienceBlendMode;
    exclusiveGroups?: string[];
    targetPages?: string[];
    maxParticleBudget?: number;
    config?: SeasonalExperienceConfig;
  }) =>
    apiFetch<ExperienceDetailDto>("/api/v1/admin/experiences", {
      method: "POST",
      body,
    }),
  update: (
    id: string,
    body: {
      name?: string;
      slug?: string;
      description?: string;
      category?: string;
      activationMode?: ActivationMode;
      manualOverride?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      clearScheduleDates?: boolean;
      timezone?: string;
      recurrenceRule?: RecurrenceRule;
      priority?: number;
      blendMode?: ExperienceBlendMode;
      exclusiveGroups?: string[];
      targetPages?: string[];
      maxParticleBudget?: number;
      expectedVersion?: number;
    }
  ) =>
    apiFetch<ExperienceDetailDto>(`/api/v1/admin/experiences/${id}`, {
      method: "PATCH",
      body,
    }),
  saveVersion: (
    id: string,
    body: {
      config: SeasonalExperienceConfig;
      changeSummary?: string;
      expectedVersion?: number;
      publishIfActive?: boolean;
    }
  ) =>
    apiFetch<ExperienceDetailDto>(`/api/v1/admin/experiences/${id}/versions`, {
      method: "POST",
      body,
    }),
  duplicate: (id: string) =>
    apiFetch<ExperienceDetailDto>(`/api/v1/admin/experiences/${id}/duplicate`, {
      method: "POST",
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/v1/admin/experiences/${id}`, {
      method: "DELETE",
    }),
  activate: (id: string, body?: { versionId?: string; manualOverride?: boolean }) =>
    apiFetch<ExperienceDetailDto>(`/api/v1/admin/experiences/${id}/activate`, {
      method: "POST",
      body: body || {},
    }),
  deactivate: (id: string) =>
    apiFetch<ExperienceDetailDto>(`/api/v1/admin/experiences/${id}/deactivate`, {
      method: "POST",
    }),
  schedule: (
    id: string,
    body: {
      startsAt: string;
      endsAt?: string | null;
      timezone?: string;
      recurrenceRule?: RecurrenceRule;
    }
  ) =>
    apiFetch<ExperienceDetailDto>(`/api/v1/admin/experiences/${id}/schedule`, {
      method: "POST",
      body,
    }),
  rollback: (id: string, versionId: string) =>
    apiFetch<ExperienceDetailDto>(
      `/api/v1/admin/experiences/${id}/rollback/${versionId}`,
      { method: "POST" }
    ),
  getSettings: () =>
    apiFetch<ExperienceSettingsDto>("/api/v1/admin/experiences/settings"),
  updateSettings: (body: {
    enabled?: boolean;
    conflictStrategy?: ConflictStrategy | string;
    maxConcurrentExperiences?: number;
    globalParticleCap?: number;
    mobilePerformanceMode?: MobilePerformanceMode | string;
    respectReducedMotion?: boolean;
    fallbackBehavior?: FallbackBehavior | string;
    defaultExperienceId?: string | null;
    clearDefaultExperience?: boolean;
    allowCustomerDismiss?: boolean;
  }) =>
    apiFetch<ExperienceSettingsDto>("/api/v1/admin/experiences/settings", {
      method: "PUT",
      body,
    }),
  simulate: (at?: string, route?: string) => {
    const qs = new URLSearchParams();
    if (at) qs.set("at", at);
    if (route) qs.set("route", route);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<ResolvedStorefrontExperienceDto>(
      `/api/v1/admin/experiences/simulate${suffix}`
    );
  },
  aiDesign: (body: {
    experienceId?: string;
    prompt: string;
    model?: string;
    currentConfig: SeasonalExperienceConfig;
    history?: Pick<ExperienceAiChatTurn, "role" | "content">[];
  }) =>
    apiFetch<ExperienceAiDesignResponse>("/api/v1/admin/experiences/ai/design", {
      method: "POST",
      body,
    }),
};
