import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperienceAiBar } from "../builder/ExperienceAiBar";
import { ExperiencesHub } from "../builder/ExperiencesHub";
import { useExperienceStudioStore } from "../builder/experience-store";
import type {
  ExperienceDetailDto,
  ExperienceSettingsDto,
  ExperienceSummaryDto,
  ExperienceTemplateDto,
  ResolvedStorefrontExperienceDto,
} from "../types";

const pushMock = vi.fn();

const apiMocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  list: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  simulate: vi.fn(),
  create: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
  aiDesign: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("@/hooks/use-ai-models", () => ({
  useAiModels: () => ({
    models: [
      {
        id: "claude-sonnet-4",
        label: "Claude Sonnet 4",
        provider: "9Router",
        badge: "Default",
      },
    ],
    defaultModelId: "claude-sonnet-4",
    settings: undefined,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../api", () => ({
  experienceAdminApi: apiMocks,
}));

const MOCK_TEMPLATES: ExperienceTemplateDto[] = [
  {
    presetKey: "christmas-wonderland",
    name: "Christmas Wonderland",
    category: "HOLIDAY",
    description: "Santa sleigh, string lights, corner pine, and snowfall.",
    accentColor: "#DC2626",
    previewGradient: "linear-gradient(135deg, #166534 0%, #DC2626 100%)",
    tags: ["holiday", "snow", "santa"],
    defaultPriority: 80,
    defaultBlendMode: "OVERRIDE",
    defaultExclusiveGroups: ["weather_particles", "theme_palette"],
    config: {
      schemaVersion: 1,
      themeOverride: { enabled: true, mode: "accent_tint" },
      motion: { respectReducedMotion: true, mobileDensityRatio: 0.5, pauseOnHiddenTab: true },
      layers: [
        {
          id: "snow-1",
          type: "snowfall",
          label: "Snowfall",
          enabled: true,
          locked: false,
          zone: "viewport_overlay",
          zIndex: 25,
          opacity: 0.9,
          blendMode: "normal",
          visibility: { desktop: true, tablet: true, mobile: true },
          trigger: "immediate",
          props: { density: 60 },
        },
      ],
    },
  },
  {
    presetKey: "lunar-new-year",
    name: "Lunar New Year / Tết",
    category: "CULTURAL",
    description: "Fireworks, peach & apricot blossoms, and red lanterns.",
    accentColor: "#DC2626",
    previewGradient: "linear-gradient(135deg, #991B1B 0%, #F59E0B 100%)",
    tags: ["tet", "fireworks", "lanterns"],
    defaultPriority: 85,
    defaultBlendMode: "OVERRIDE",
    defaultExclusiveGroups: ["weather_particles"],
    config: {
      schemaVersion: 1,
      themeOverride: { enabled: true, mode: "accent_tint" },
      motion: { respectReducedMotion: true, mobileDensityRatio: 0.5, pauseOnHiddenTab: true },
      layers: [],
    },
  },
  {
    presetKey: "flash-sale-surge",
    name: "Flash Sale Surge",
    category: "FLASH_SALE",
    description: "Countdown bar, animated promo banner, and gold sparks.",
    accentColor: "#EA580C",
    previewGradient: "linear-gradient(135deg, #EA580C 0%, #FACC15 100%)",
    tags: ["flash-sale", "countdown"],
    defaultPriority: 95,
    defaultBlendMode: "STACK",
    defaultExclusiveGroups: ["promo_highlight"],
    config: {
      schemaVersion: 1,
      themeOverride: { enabled: true, mode: "accent_tint" },
      motion: { respectReducedMotion: true, mobileDensityRatio: 0.5, pauseOnHiddenTab: true },
      layers: [],
    },
  },
];

const MOCK_EXPERIENCES: ExperienceSummaryDto[] = [
  {
    id: "exp-1",
    slug: "christmas-wonderland",
    name: "Christmas Wonderland",
    description: "Festive store look",
    category: "HOLIDAY",
    presetKey: "christmas-wonderland",
    status: "DRAFT",
    activationMode: "MANUAL",
    manualOverride: false,
    startsAt: null,
    endsAt: null,
    timezone: "UTC",
    recurrenceRule: "NONE",
    priority: 80,
    blendMode: "OVERRIDE",
    exclusiveGroups: ["weather_particles"],
    targetPages: ["*"],
    maxParticleBudget: 120,
    activeVersionId: null,
    latestVersionNumber: 1,
    layerCount: 3,
    version: 0,
    updatedAt: "2026-11-27T00:00:00Z",
  },
  {
    id: "exp-2",
    slug: "flash-sale-surge",
    name: "Flash Sale Surge",
    description: "Urgent weekend drop",
    category: "FLASH_SALE",
    presetKey: "flash-sale-surge",
    status: "ACTIVE",
    activationMode: "MANUAL",
    manualOverride: true,
    startsAt: null,
    endsAt: null,
    timezone: "UTC",
    recurrenceRule: "NONE",
    priority: 95,
    blendMode: "STACK",
    exclusiveGroups: ["promo_highlight"],
    targetPages: ["*"],
    maxParticleBudget: 80,
    activeVersionId: "ver-2",
    latestVersionNumber: 1,
    layerCount: 2,
    version: 1,
    updatedAt: "2026-11-27T00:00:00Z",
  },
];

const MOCK_SETTINGS: ExperienceSettingsDto = {
  storeId: "store-1",
  enabled: true,
  conflictStrategy: "PRIORITY_STACK",
  maxConcurrentExperiences: 2,
  globalParticleCap: 160,
  mobilePerformanceMode: "ADAPTIVE",
  respectReducedMotion: true,
  fallbackBehavior: "REVERT_DEFAULT_THEME",
  defaultExperienceId: null,
  allowCustomerDismiss: true,
  updatedAt: "2026-11-27T00:00:00Z",
};

const MOCK_SIMULATION: ResolvedStorefrontExperienceDto = {
  enabled: true,
  resolvedAt: "2026-11-27T12:00:00Z",
  nextTransitionAt: "2026-11-28T00:00:00Z",
  mobilePerformanceMode: "ADAPTIVE",
  respectReducedMotion: true,
  allowCustomerDismiss: true,
  globalParticleCap: 160,
  activeExperiences: [
    {
      id: "exp-2",
      slug: "flash-sale-surge",
      name: "Flash Sale Surge",
      category: "FLASH_SALE",
      priority: 95,
      blendMode: "STACK",
      targetPages: ["*"],
    },
  ],
  effectiveThemeOverride: { enabled: true, mode: "accent_tint" },
  layers: [
    {
      sourceExperienceId: "exp-2",
      sourceExperienceName: "Flash Sale Surge",
      id: "cd-1",
      type: "countdown_bar",
      label: "Flash Countdown",
      zone: "hero_stage",
      zIndex: 44,
      opacity: 1,
      blendMode: "normal",
      visibility: { desktop: true, tablet: true, mobile: true },
      trigger: "immediate",
      effectiveDensityScale: 1,
      targetPages: ["*"],
      props: { title: "Flash Ends In" },
    },
  ],
  resolutionTrace: [
    "Selected 'Flash Sale Surge' (P95, STACK) for route '/'",
    "Total particle budget within cap (80/160)",
  ],
};

const SAMPLE_DETAIL: ExperienceDetailDto = {
  id: "exp-created",
  slug: "custom-event",
  name: "Custom Event",
  description: "Custom",
  category: "CUSTOM",
  presetKey: null,
  status: "DRAFT",
  activationMode: "MANUAL",
  manualOverride: false,
  startsAt: null,
  endsAt: null,
  timezone: "UTC",
  recurrenceRule: "NONE",
  priority: 50,
  blendMode: "OVERRIDE",
  exclusiveGroups: [],
  targetPages: ["*"],
  maxParticleBudget: 120,
  activeVersionId: null,
  latestVersionNumber: 1,
  version: 0,
  latestVersion: {
    id: "ver-1",
    versionNumber: 1,
    config: {
      schemaVersion: 1,
      themeOverride: { enabled: false, mode: "accent_tint" },
      motion: { respectReducedMotion: true, mobileDensityRatio: 0.5, pauseOnHiddenTab: true },
      layers: [],
    },
    changeSummary: "Initial",
    createdAt: "2026-11-27T00:00:00Z",
  },
  activeVersion: null,
  versions: [],
  updatedAt: "2026-11-27T00:00:00Z",
};

function renderWithQuery(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("Experience Builder Hub & AI Director UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listTemplates.mockResolvedValue(MOCK_TEMPLATES);
    apiMocks.list.mockResolvedValue(MOCK_EXPERIENCES);
    apiMocks.getSettings.mockResolvedValue(MOCK_SETTINGS);
    apiMocks.simulate.mockResolvedValue(MOCK_SIMULATION);
    apiMocks.create.mockResolvedValue(SAMPLE_DETAIL);
    apiMocks.activate.mockResolvedValue({ ...MOCK_EXPERIENCES[0], status: "ACTIVE" });
    apiMocks.deactivate.mockResolvedValue({ ...MOCK_EXPERIENCES[1], status: "PAUSED" });
    useExperienceStudioStore.getState().loadExperience(SAMPLE_DETAIL);
    useExperienceStudioStore.getState().toggleAiBar(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders templates, filters by category & search, creates from template and custom modal", async () => {
    const notify = vi.fn();
    renderWithQuery(<ExperiencesHub notify={notify} />);

    // Templates loaded & rendered
    expect(await screen.findByText("Christmas Wonderland")).toBeInTheDocument();
    expect(screen.getByText("Lunar New Year / Tết")).toBeInTheDocument();
    expect(screen.getByText("Flash Sale Surge")).toBeInTheDocument();

    // Filter by category pill
    fireEvent.click(screen.getByRole("button", { name: "Holidays" }));
    expect(screen.getByText("Christmas Wonderland")).toBeInTheDocument();
    expect(screen.queryByText("Lunar New Year / Tết")).not.toBeInTheDocument();

    // Use Template triggers create + navigation
    fireEvent.click(screen.getByRole("button", { name: /Use Template/i }));
    await waitFor(() => {
      expect(apiMocks.create).toHaveBeenCalledWith({
        name: "Christmas Wonderland",
        category: "HOLIDAY",
        description: "Santa sleigh, string lights, corner pine, and snowfall.",
        presetKey: "christmas-wonderland",
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/admin/experiences/exp-created");

    // Reset filter and open Custom Event dialog
    fireEvent.click(screen.getByRole("button", { name: "All Events" }));
    fireEvent.click(screen.getByRole("button", { name: /Create Custom Event/i }));

    fireEvent.change(screen.getByPlaceholderText(/Anniversary Week Gold Drop/i), {
      target: { value: "Midnight VIP Launch" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Short description/i), {
      target: { value: "VIP dark gold launch" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create & Open Studio/i }));

    await waitFor(() => {
      expect(apiMocks.create).toHaveBeenCalledWith({
        name: "Midnight VIP Launch",
        category: "CUSTOM",
        description: "VIP dark gold launch",
      });
    });
  });

  it("manages store experiences activation/deactivation and displays conflict simulator trace", async () => {
    const notify = vi.fn();
    renderWithQuery(<ExperiencesHub notify={notify} />);

    await screen.findByText("Christmas Wonderland");

    // Switch to Store Experiences tab
    fireEvent.click(screen.getByRole("tab", { name: /Store Experiences/i }));
    expect(await screen.findByText("Festive store look")).toBeInTheDocument();
    expect(screen.getByText("Urgent weekend drop")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Activate$/i }));
    await waitFor(() => {
      expect(apiMocks.activate).toHaveBeenCalledWith("exp-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /^Deactivate$/i }));
    await waitFor(() => {
      expect(apiMocks.deactivate).toHaveBeenCalledWith("exp-2");
    });

    // Switch to Schedule & Conflict Simulator tab
    fireEvent.click(screen.getByRole("tab", { name: /Schedule & Conflict Simulator/i }));
    expect(
      await screen.findByText("Store-Wide Interaction & Performance Policy")
    ).toBeInTheDocument();
    expect(await screen.findByText("Flash Countdown")).toBeInTheDocument();
    expect(
      screen.getByText("Selected 'Flash Sale Surge' (P95, STACK) for route '/'")
    ).toBeInTheDocument();
  });

  it("submits AI prompt in ExperienceAiBar, toggles Before/After preview, and applies design", async () => {
    const onNotify = vi.fn();
    apiMocks.aiDesign.mockResolvedValue({
      model: "claude-sonnet-4",
      summary: "Black Friday Dark Luxe with Golden Particles",
      explanation: "Enabled dark luxe palette and golden spark embers.",
      operations: [
        {
          type: "add_layer",
          targetId: "gold-1",
          description: "Added Golden Particles overlay",
        },
      ],
      proposedConfig: {
        schemaVersion: 1,
        themeOverride: { enabled: true, mode: "dark_luxe", colors: { primary: "#EAB308" } },
        motion: { respectReducedMotion: true, mobileDensityRatio: 0.5, pauseOnHiddenTab: true },
        layers: [
          {
            id: "gold-1",
            type: "golden_particles",
            label: "Golden Sparks",
            enabled: true,
            locked: false,
            zone: "viewport_overlay",
            zIndex: 25,
            opacity: 0.9,
            blendMode: "screen",
            visibility: { desktop: true, tablet: true, mobile: true },
            trigger: "immediate",
            props: { density: 75 },
          },
        ],
      },
      promptTokens: 120,
      completionTokens: 210,
      latencyMs: 32,
    });

    renderWithQuery(<ExperienceAiBar onNotify={onNotify} />);

    const input = screen.getByPlaceholderText(/Ask AI to design or refine/i);
    fireEvent.change(input, {
      target: { value: "Black Friday dark luxe with golden particles" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Design$/i }));

    await waitFor(() => {
      expect(apiMocks.aiDesign).toHaveBeenCalledWith(
        expect.objectContaining({
          experienceId: "exp-created",
          prompt: "Black Friday dark luxe with golden particles",
        })
      );
    });

    // Diff banner is rendered
    expect(
      await screen.findByText("Black Friday Dark Luxe with Golden Particles")
    ).toBeInTheDocument();
    expect(useExperienceStudioStore.getState().aiPreview?.viewMode).toBe("after");

    // Toggle Before / After
    fireEvent.click(screen.getByRole("button", { name: "Before" }));
    expect(useExperienceStudioStore.getState().aiPreview?.viewMode).toBe("before");

    fireEvent.click(screen.getByRole("button", { name: "After" }));
    expect(useExperienceStudioStore.getState().aiPreview?.viewMode).toBe("after");

    // Apply Design mutates store & clears preview
    fireEvent.click(screen.getByRole("button", { name: /Apply Design/i }));
    const finalState = useExperienceStudioStore.getState();
    expect(finalState.aiPreview).toBeNull();
    expect(finalState.config.layers).toHaveLength(1);
    expect(finalState.config.layers[0].type).toBe("golden_particles");
    expect(finalState.config.themeOverride.mode).toBe("dark_luxe");
    expect(onNotify).toHaveBeenCalledWith("Applied AI seasonal design to draft");
  });
});
