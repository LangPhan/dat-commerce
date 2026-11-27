"use client";

import { create } from "zustand";
import { createLayerFromCatalog } from "../catalog";
import {
  createEmptyExperienceConfig,
  normalizeExperienceConfig,
} from "../schema";
import type {
  ActivationMode,
  EffectLayerType,
  ExperienceAiChatTurn,
  ExperienceAiOperationDto,
  ExperienceBlendMode,
  ExperienceDetailDto,
  ExperienceLayer,
  ExperienceMotionConfig,
  ExperienceZone,
  RecurrenceRule,
  SeasonalExperienceConfig,
  ThemeOverrideConfig,
} from "../types";

export type StudioViewport = "desktop" | "tablet" | "mobile";
export type StudioPreviewRoute = "home" | "shop" | "product";

export type AiPreviewState = {
  beforeConfig: SeasonalExperienceConfig;
  proposedConfig: SeasonalExperienceConfig;
  summary: string;
  explanation: string;
  operations: ExperienceAiOperationDto[];
  viewMode: "after" | "before";
};

type MetaDraft = {
  name: string;
  slug: string;
  description: string;
  category: string;
  status: string;
};

type ScheduleDraft = {
  activationMode: ActivationMode;
  manualOverride: boolean;
  startsAt: string;
  endsAt: string;
  timezone: string;
  recurrenceRule: RecurrenceRule;
};

type InteractionDraft = {
  priority: number;
  blendMode: ExperienceBlendMode;
  exclusiveGroups: string[];
  targetPages: string[];
  maxParticleBudget: number;
};

type ExperienceStoreState = {
  experienceId: string;
  version: number;
  latestVersionNumber: number;
  activeVersionId: string | null;
  meta: MetaDraft;
  schedule: ScheduleDraft;
  interaction: InteractionDraft;
  config: SeasonalExperienceConfig;
  selectedLayerId: string | null;
  previewRoute: StudioPreviewRoute;
  viewport: StudioViewport;
  zoom: number;
  compareBase: boolean;
  effectsPaused: boolean;
  simulateReducedMotion: boolean;
  aiBarOpen: boolean;
  aiHistory: ExperienceAiChatTurn[];
  aiPreview: AiPreviewState | null;
  dirty: boolean;
  metaDirty: boolean;
  history: SeasonalExperienceConfig[];
  historyIndex: number;

  loadExperience: (detail: ExperienceDetailDto) => void;
  selectLayer: (id: string | null) => void;
  setPreviewRoute: (route: StudioPreviewRoute) => void;
  setViewport: (vp: StudioViewport) => void;
  setZoom: (zoom: number) => void;
  setCompareBase: (v: boolean) => void;
  setEffectsPaused: (v: boolean) => void;
  setSimulateReducedMotion: (v: boolean) => void;
  toggleAiBar: (open?: boolean) => void;

  addLayer: (type: EffectLayerType, zone?: ExperienceZone, index?: number) => void;
  updateLayer: (id: string, patch: Partial<ExperienceLayer>) => void;
  updateLayerProps: (id: string, patchProps: Record<string, unknown>) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;

  updateThemeOverride: (patch: Partial<ThemeOverrideConfig>) => void;
  updateMotion: (patch: Partial<ExperienceMotionConfig>) => void;
  applyTemplateConfig: (cfg: SeasonalExperienceConfig) => void;

  updateMeta: (patch: Partial<MetaDraft>) => void;
  updateSchedule: (patch: Partial<ScheduleDraft>) => void;
  updateInteraction: (patch: Partial<InteractionDraft>) => void;

  pushAiChatTurn: (turn: ExperienceAiChatTurn) => void;
  clearAiChat: () => void;
  setAiPreview: (preview: Omit<AiPreviewState, "viewMode">) => void;
  toggleAiPreviewMode: (mode?: "after" | "before") => void;
  applyAiPreview: () => void;
  discardAiPreview: () => void;

  undo: () => void;
  redo: () => void;
  markSaved: (detail: ExperienceDetailDto) => void;
};

const MAX_HISTORY = 50;

function pushHistory(
  state: ExperienceStoreState,
  nextConfig: SeasonalExperienceConfig
): Partial<ExperienceStoreState> {
  const baseHistory = state.history.slice(0, state.historyIndex + 1);
  const appended = [...baseHistory, structuredClone(nextConfig)];
  const trimmed = appended.length > MAX_HISTORY ? appended.slice(appended.length - MAX_HISTORY) : appended;
  return {
    config: nextConfig,
    dirty: true,
    history: trimmed,
    historyIndex: trimmed.length - 1,
  };
}

export const useExperienceStudioStore = create<ExperienceStoreState>((set, get) => ({
  experienceId: "",
  version: 0,
  latestVersionNumber: 1,
  activeVersionId: null,
  meta: {
    name: "",
    slug: "",
    description: "",
    category: "CUSTOM",
    status: "DRAFT",
  },
  schedule: {
    activationMode: "MANUAL",
    manualOverride: false,
    startsAt: "",
    endsAt: "",
    timezone: "UTC",
    recurrenceRule: "NONE",
  },
  interaction: {
    priority: 50,
    blendMode: "OVERRIDE",
    exclusiveGroups: [],
    targetPages: ["*"],
    maxParticleBudget: 120,
  },
  config: createEmptyExperienceConfig(),
  selectedLayerId: null,
  previewRoute: "home",
  viewport: "desktop",
  zoom: 1,
  compareBase: false,
  effectsPaused: false,
  simulateReducedMotion: false,
  aiBarOpen: true,
  aiHistory: [],
  aiPreview: null,
  dirty: false,
  metaDirty: false,
  history: [createEmptyExperienceConfig()],
  historyIndex: 0,

  loadExperience: (detail) => {
    const normalized = normalizeExperienceConfig(detail.latestVersion?.config);
    set({
      experienceId: detail.id,
      version: detail.version,
      latestVersionNumber: detail.latestVersionNumber,
      activeVersionId: detail.activeVersionId || null,
      meta: {
        name: detail.name,
        slug: detail.slug,
        description: detail.description || "",
        category: detail.category,
        status: detail.status,
      },
      schedule: {
        activationMode: (detail.activationMode === "SCHEDULED" ? "SCHEDULED" : "MANUAL") as ActivationMode,
        manualOverride: Boolean(detail.manualOverride),
        startsAt: detail.startsAt || "",
        endsAt: detail.endsAt || "",
        timezone: detail.timezone || "UTC",
        recurrenceRule: (detail.recurrenceRule || "NONE") as RecurrenceRule,
      },
      interaction: {
        priority: detail.priority,
        blendMode: (detail.blendMode || "OVERRIDE") as ExperienceBlendMode,
        exclusiveGroups: detail.exclusiveGroups || [],
        targetPages: detail.targetPages?.length ? detail.targetPages : ["*"],
        maxParticleBudget: detail.maxParticleBudget || 120,
      },
      config: normalized,
      selectedLayerId: normalized.layers[0]?.id || null,
      aiPreview: null,
      dirty: false,
      metaDirty: false,
      history: [structuredClone(normalized)],
      historyIndex: 0,
    });
  },

  selectLayer: (id) => set({ selectedLayerId: id }),
  setPreviewRoute: (previewRoute) => set({ previewRoute }),
  setViewport: (viewport) => set({ viewport }),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(1.25, zoom)) }),
  setCompareBase: (compareBase) => set({ compareBase }),
  setEffectsPaused: (effectsPaused) => set({ effectsPaused }),
  setSimulateReducedMotion: (simulateReducedMotion) => set({ simulateReducedMotion }),
  toggleAiBar: (open) => set((s) => ({ aiBarOpen: open ?? !s.aiBarOpen })),

  addLayer: (type, zone, index) => {
    const state = get();
    const created = createLayerFromCatalog(type, zone);
    const nextLayers = [...state.config.layers];
    if (typeof index === "number" && index >= 0 && index <= nextLayers.length) {
      nextLayers.splice(index, 0, created);
    } else {
      nextLayers.push(created);
    }
    const nextConfig: SeasonalExperienceConfig = { ...state.config, layers: nextLayers };
    set({
      ...pushHistory(state, nextConfig),
      selectedLayerId: created.id,
    });
  },

  updateLayer: (id, patch) => {
    const state = get();
    const nextLayers = state.config.layers.map((l) =>
      l.id === id ? { ...l, ...patch } : l
    );
    set(pushHistory(state, { ...state.config, layers: nextLayers }));
  },

  updateLayerProps: (id, patchProps) => {
    const state = get();
    const nextLayers = state.config.layers.map((l) =>
      l.id === id ? { ...l, props: { ...l.props, ...patchProps } } : l
    );
    set(pushHistory(state, { ...state.config, layers: nextLayers }));
  },

  removeLayer: (id) => {
    const state = get();
    const nextLayers = state.config.layers.filter((l) => l.id !== id);
    set({
      ...pushHistory(state, { ...state.config, layers: nextLayers }),
      selectedLayerId:
        state.selectedLayerId === id ? nextLayers[0]?.id || null : state.selectedLayerId,
    });
  },

  duplicateLayer: (id) => {
    const state = get();
    const idx = state.config.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const src = state.config.layers[idx];
    const copy: ExperienceLayer = {
      ...structuredClone(src),
      id: `${src.id}-copy-${Math.random().toString(36).slice(2, 6)}`,
      label: `${src.label} Copy`,
      locked: false,
    };
    const nextLayers = [...state.config.layers];
    nextLayers.splice(idx + 1, 0, copy);
    set({
      ...pushHistory(state, { ...state.config, layers: nextLayers }),
      selectedLayerId: copy.id,
    });
  },

  reorderLayers: (fromIndex, toIndex) => {
    const state = get();
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.config.layers.length ||
      toIndex >= state.config.layers.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const nextLayers = [...state.config.layers];
    const [moved] = nextLayers.splice(fromIndex, 1);
    nextLayers.splice(toIndex, 0, moved);
    set(pushHistory(state, { ...state.config, layers: nextLayers }));
  },

  toggleLayerVisibility: (id) => {
    const state = get();
    const nextLayers = state.config.layers.map((l) =>
      l.id === id ? { ...l, enabled: !l.enabled } : l
    );
    set(pushHistory(state, { ...state.config, layers: nextLayers }));
  },

  toggleLayerLock: (id) => {
    const state = get();
    const nextLayers = state.config.layers.map((l) =>
      l.id === id ? { ...l, locked: !l.locked } : l
    );
    set(pushHistory(state, { ...state.config, layers: nextLayers }));
  },

  updateThemeOverride: (patch) => {
    const state = get();
    const nextTheme: ThemeOverrideConfig = {
      ...state.config.themeOverride,
      ...patch,
      colors: patch.colors
        ? { ...state.config.themeOverride.colors, ...patch.colors }
        : state.config.themeOverride.colors,
      backdrop: patch.backdrop
        ? {
            ...state.config.themeOverride.backdrop,
            ...patch.backdrop,
            kind:
              patch.backdrop.kind ??
              state.config.themeOverride.backdrop?.kind ??
              "none",
          }
        : state.config.themeOverride.backdrop,
      headerOverride: patch.headerOverride
        ? { ...state.config.themeOverride.headerOverride, ...patch.headerOverride }
        : state.config.themeOverride.headerOverride,
      ctaHighlight: patch.ctaHighlight
        ? {
            ...state.config.themeOverride.ctaHighlight,
            ...patch.ctaHighlight,
            enabled:
              patch.ctaHighlight.enabled ??
              state.config.themeOverride.ctaHighlight?.enabled ??
              false,
          }
        : state.config.themeOverride.ctaHighlight,
    };
    set(pushHistory(state, { ...state.config, themeOverride: nextTheme }));
  },

  updateMotion: (patch) => {
    const state = get();
    set(
      pushHistory(state, {
        ...state.config,
        motion: { ...state.config.motion, ...patch },
      })
    );
  },

  applyTemplateConfig: (cfg) => {
    const state = get();
    const normalized = normalizeExperienceConfig(cfg);
    set({
      ...pushHistory(state, normalized),
      selectedLayerId: normalized.layers[0]?.id || null,
    });
  },

  updateMeta: (patch) =>
    set((s) => ({ meta: { ...s.meta, ...patch }, metaDirty: true })),
  updateSchedule: (patch) =>
    set((s) => ({ schedule: { ...s.schedule, ...patch }, metaDirty: true })),
  updateInteraction: (patch) =>
    set((s) => ({ interaction: { ...s.interaction, ...patch }, metaDirty: true })),

  pushAiChatTurn: (turn) =>
    set((s) => ({ aiHistory: [...s.aiHistory.slice(-16), turn] })),
  clearAiChat: () => set({ aiHistory: [], aiPreview: null }),

  setAiPreview: (preview) =>
    set({
      aiPreview: {
        ...preview,
        proposedConfig: normalizeExperienceConfig(preview.proposedConfig),
        viewMode: "after",
      },
    }),

  toggleAiPreviewMode: (mode) =>
    set((s) => {
      if (!s.aiPreview) return {};
      const nextMode = mode || (s.aiPreview.viewMode === "after" ? "before" : "after");
      return { aiPreview: { ...s.aiPreview, viewMode: nextMode } };
    }),

  applyAiPreview: () => {
    const state = get();
    if (!state.aiPreview) return;
    const nextConfig = normalizeExperienceConfig(state.aiPreview.proposedConfig);
    set({
      ...pushHistory(state, nextConfig),
      selectedLayerId: nextConfig.layers[0]?.id || state.selectedLayerId,
      aiPreview: null,
    });
  },

  discardAiPreview: () => set({ aiPreview: null }),

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const nextIndex = state.historyIndex - 1;
    const nextConfig = structuredClone(state.history[nextIndex]);
    set({
      config: nextConfig,
      historyIndex: nextIndex,
      dirty: true,
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const nextIndex = state.historyIndex + 1;
    const nextConfig = structuredClone(state.history[nextIndex]);
    set({
      config: nextConfig,
      historyIndex: nextIndex,
      dirty: true,
    });
  },

  markSaved: (detail) =>
    set({
      version: detail.version,
      latestVersionNumber: detail.latestVersionNumber,
      activeVersionId: detail.activeVersionId || null,
      meta: {
        name: detail.name,
        slug: detail.slug,
        description: detail.description || "",
        category: detail.category,
        status: detail.status,
      },
      schedule: {
        activationMode: (detail.activationMode === "SCHEDULED" ? "SCHEDULED" : "MANUAL") as ActivationMode,
        manualOverride: Boolean(detail.manualOverride),
        startsAt: detail.startsAt || "",
        endsAt: detail.endsAt || "",
        timezone: detail.timezone || "UTC",
        recurrenceRule: (detail.recurrenceRule || "NONE") as RecurrenceRule,
      },
      interaction: {
        priority: detail.priority,
        blendMode: (detail.blendMode || "OVERRIDE") as ExperienceBlendMode,
        exclusiveGroups: detail.exclusiveGroups || [],
        targetPages: detail.targetPages?.length ? detail.targetPages : ["*"],
        maxParticleBudget: detail.maxParticleBudget || 120,
      },
      dirty: false,
      metaDirty: false,
    }),
}));
