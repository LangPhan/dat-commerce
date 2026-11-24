"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Check,
  Columns,
  Layers,
  MousePointerClick,
  Palette,
  Redo2,
  RotateCcw,
  Sparkles,
  Type,
  Undo2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/features/auth/auth-context";
import type { ViewportMode } from "@/features/builder/types";
import {
  createCustomPaletteColor,
  getBrandPaletteOptions,
} from "@/features/editor/brand-palette";
import { ColorControl } from "@/features/editor/inspector-controls";
import { FontFamiliesPanel } from "@/features/typography/components/FontFamiliesPanel";
import {
  TypographyAiBar,
  type TypographyAiPreviewState,
} from "@/features/typography/components/TypographyAiBar";
import { TypographyPresetsPanel } from "@/features/typography/components/TypographyPresetsPanel";
import { TypographyPreviewPanel } from "@/features/typography/components/TypographyPreviewPanel";
import {
  normalizeGlobalTypography,
  resetAllTypography,
} from "@/features/typography/defaults";
import { formatCssFontStack } from "@/features/typography/resolve";
import type {
  NormalizedGlobalTypography,
  TypographyFontConfig,
  TypographyFontRole,
} from "@/features/typography/types";
import { ApiError } from "@/lib/api-client";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { themeTokensSchema } from "@/lib/cms-schema";
import { cn, formatDateTime } from "@/lib/format";
import type {
  AdminThemeResponse,
  ThemeTokens,
  ThemeVersionDto,
} from "@/types/api-cms-ai";

type ThemeSectionId =
  | "colors"
  | "typography"
  | "layout"
  | "spacing"
  | "buttons"
  | "components";

type TypoSubTab = "presets" | "fonts" | "specimen";

type ThemeHistoryEntry = {
  id: string;
  summary: string;
  source: "manual" | "ai";
  timestamp: string;
  before: ThemeTokens;
  after: ThemeTokens;
};

function makeThemeHistoryEntry(
  seq: number,
  summary: string,
  source: "manual" | "ai",
  before: ThemeTokens,
  after: ThemeTokens
): ThemeHistoryEntry {
  return {
    id: `th-${seq}`,
    summary,
    source,
    timestamp: new Date().toISOString(),
    before,
    after,
  };
}

const NAV_ITEMS: Array<{
  id: ThemeSectionId;
  label: string;
  icon: typeof Palette;
}> = [
  { id: "colors", label: "Global Colors", icon: Palette },
  { id: "typography", label: "Global Typography", icon: Type },
  { id: "layout", label: "Global Layout", icon: Columns },
  { id: "spacing", label: "Global Spacing", icon: Layers },
  { id: "buttons", label: "Global Buttons", icon: MousePointerClick },
  { id: "components", label: "Global Components", icon: Box },
];

const FALLBACK_TOKENS: ThemeTokens = {
  version: 1,
  colors: {
    primary: "#5B46E8",
    secondary: "#1F2937",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    text: "#111318",
    muted: "#5C6270",
    accent: "#18794E",
    border: "#E5E7EB",
  },
  typography: { headingFont: "Georgia", bodyFont: "Inter" },
  radius: { card: "10px", button: "8px" },
  container: { maxWidth: "1280px" },
  spacing: { sectionY: "64px", blockGap: "24px" },
  shadows: {
    card: "0 1px 3px rgba(15, 23, 42, 0.08)",
    elevated: "0 12px 32px rgba(15, 23, 42, 0.14)",
  },
};

function readInitialSection(): ThemeSectionId {
  if (typeof window === "undefined") return "colors";
  const raw = new URLSearchParams(window.location.search).get("section");
  if (
    raw === "colors" ||
    raw === "typography" ||
    raw === "layout" ||
    raw === "spacing" ||
    raw === "buttons" ||
    raw === "components"
  ) {
    return raw;
  }
  return "colors";
}

function ThemeWorkspace({
  data,
  canWrite,
  canPublish,
  notify,
}: {
  data: AdminThemeResponse;
  canWrite: boolean;
  canPublish: boolean;
  notify: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const baseServerTokens =
    data.latest?.tokens || data.published?.tokens || FALLBACK_TOKENS;

  const [section, setSection] = useState<ThemeSectionId>(readInitialSection);
  const [typoSubTab, setTypoSubTab] = useState<TypoSubTab>("presets");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [selectedPresetId, setSelectedPresetId] = useState("h1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [resetAllOpen, setResetAllOpen] = useState(false);

  const [tokens, setTokens] = useState<ThemeTokens>(baseServerTokens);
  const [, setSyncedServerId] = useState<string | null>(
    data.latest?.id || data.published?.id || null
  );
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<ThemeHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [aiPreview, setAiPreview] = useState<TypographyAiPreviewState | null>(
    null
  );
  const histSeqRef = useRef(0);

  const effectiveTokens: ThemeTokens = useMemo(() => {
    if (!aiPreview) return tokens;
    return aiPreview.viewMode === "after"
      ? aiPreview.previewTokens
      : aiPreview.beforeTokens;
  }, [aiPreview, tokens]);

  const normalizedTypography = useMemo(
    () => normalizeGlobalTypography(effectiveTokens.typography),
    [effectiveTokens.typography]
  );

  const commitTokensChange = (
    next: ThemeTokens,
    summary: string,
    source: "manual" | "ai" = "manual"
  ) => {
    histSeqRef.current += 1;
    const entry = makeThemeHistoryEntry(
      histSeqRef.current,
      summary,
      source,
      tokens,
      next
    );
    const nextHist = [...history.slice(0, historyIndex + 1), entry].slice(-60);
    setTokens(next);
    setHistory(nextHist);
    setHistoryIndex(nextHist.length - 1);
    setDirty(true);
    setError("");
  };

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const entry = history[historyIndex];
    setTokens(entry.before);
    setHistoryIndex(historyIndex - 1);
    setDirty(true);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const entry = history[historyIndex + 1];
    setTokens(entry.after);
    setHistoryIndex(historyIndex + 1);
    setDirty(true);
  };

  const saveDraftMutation = useMutation({
    mutationFn: (payload: { next: ThemeTokens; note?: string }) =>
      cmsAdminApi.createThemeVersion(payload.next, payload.note),
    onSuccess: (created) => {
      setSyncedServerId(created.id);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      notify(`Saved theme draft v${created.versionNumber}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to save theme draft"),
  });

  const saveAndPublishMutation = useMutation({
    mutationFn: async (payload: { next: ThemeTokens; note?: string }) => {
      const created = await cmsAdminApi.createThemeVersion(
        payload.next,
        payload.note
      );
      return cmsAdminApi.publishTheme(created.id);
    },
    onSuccess: (pub) => {
      setSyncedServerId(pub.id);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      notify(`Published theme v${pub.versionNumber}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to publish theme"),
  });

  const publishVersionMutation = useMutation({
    mutationFn: (versionId?: string) => cmsAdminApi.publishTheme(versionId),
    onSuccess: (pub) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      notify(`Published theme v${pub.versionNumber}`);
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to publish theme"),
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => cmsAdminApi.rollbackTheme(versionId),
    onSuccess: (rolled) => {
      setDirty(false);
      setSyncedServerId(rolled.id);
      setTokens(rolled.tokens);
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      notify(`Rolled back theme (published v${rolled.versionNumber})`);
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to rollback theme"),
  });

  const validateDraft = (): boolean => {
    setError("");
    const check = themeTokensSchema.safeParse(tokens);
    if (!check.success) {
      setError(
        check.error.issues[0]?.message || "Theme tokens failed schema validation."
      );
      return false;
    }
    return true;
  };

  const handleAddBrandColor = (name: string, hex: string) => {
    const existing = tokens.customPalette || [];
    if (existing.length >= 24) return;
    const entry = createCustomPaletteColor(name, hex, existing);
    commitTokensChange(
      { ...tokens, customPalette: [...existing, entry] },
      `Add brand color ${entry.name}`
    );
  };

  const handleUpdateFontRole = (
    role: TypographyFontRole,
    nextCfg: TypographyFontConfig
  ) => {
    const nextTypo: NormalizedGlobalTypography = {
      ...normalizedTypography,
      fonts: { ...normalizedTypography.fonts, [role]: nextCfg },
      headingFont:
        role === "heading"
          ? nextCfg.family
          : normalizedTypography.headingFont,
      bodyFont:
        role === "body" ? nextCfg.family : normalizedTypography.bodyFont,
    };
    commitTokensChange(
      { ...tokens, typography: nextTypo },
      `Update ${role} font to ${nextCfg.family}`
    );
  };

  const handleChangeTypography = (
    nextTypo: NormalizedGlobalTypography,
    summary: string
  ) => {
    commitTokensChange({ ...tokens, typography: nextTypo }, summary);
  };

  const columns: DataTableColumn<ThemeVersionDto>[] = [
    {
      id: "version",
      header: "Version",
      cell: (ver) => <strong>v{ver.versionNumber}</strong>,
    },
    {
      id: "status",
      header: "Status",
      cell: (ver) => <StatusBadge status={ver.status} />,
    },
    {
      id: "typography",
      header: "Typography",
      cell: (ver) =>
        `${ver.tokens.typography?.headingFont || "Georgia"} / ${
          ver.tokens.typography?.bodyFont || "Inter"
        }`,
    },
    {
      id: "note",
      header: "Note",
      cell: (ver) => <span className="muted">{ver.note || "—"}</span>,
    },
    {
      id: "created",
      header: "Created",
      cell: (ver) => formatDateTime(ver.createdAt),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (ver) => (
        <div className="button-row" style={{ justifyContent: "flex-end" }}>
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => {
                commitTokensChange(ver.tokens, `Load theme v${ver.versionNumber}`);
                notify(`Loaded v${ver.versionNumber} into Theme Settings draft`);
              }}
            >
              Load into studio
            </Button>
          ) : null}
          {canPublish && ver.status === "DRAFT" ? (
            <Button
              size="sm"
              variant="primary"
              disabled={publishVersionMutation.isPending}
              onClick={() => publishVersionMutation.mutate(ver.id)}
            >
              Publish
            </Button>
          ) : null}
          {canPublish && ver.status !== "PUBLISHED" ? (
            <Button
              size="sm"
              disabled={rollbackMutation.isPending}
              onClick={() => rollbackMutation.mutate(ver.id)}
            >
              <RotateCcw size={12} /> Rollback
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const palette = getBrandPaletteOptions(effectiveTokens);
  const buttonPreset = normalizedTypography.presets.button;

  return (
    <div className="theme-settings-root">
      <div className="admin-title">
        <div>
          <h1>Theme Settings</h1>
          <p>
            Centralized design tokens for Global Colors, Global Typography, Layout, Spacing, Buttons, and Components.
          </p>
        </div>
        <div className="button-row">
          {data.published ? (
            <Badge tone="green">Published v{data.published.versionNumber}</Badge>
          ) : null}
          {dirty ? <Badge tone="accent">Unsaved edits</Badge> : null}
          <Button
            type="button"
            size="sm"
            disabled={!canUndo || Boolean(aiPreview)}
            onClick={handleUndo}
            title={canUndo ? `Undo: ${history[historyIndex]?.summary}` : "Nothing to undo"}
          >
            <Undo2 size={13} />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canRedo || Boolean(aiPreview)}
            onClick={handleRedo}
            title="Redo"
          >
            <Redo2 size={13} />
          </Button>
          {canWrite ? (
            <>
              <input
                type="text"
                disabled={!canWrite}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Version note..."
                className="theme-note-input"
              />
              <Button
                type="button"
                variant={canPublish ? "default" : "primary"}
                disabled={
                  Boolean(aiPreview) ||
                  saveDraftMutation.isPending ||
                  saveAndPublishMutation.isPending
                }
                onClick={() => {
                  if (!validateDraft()) return;
                  saveDraftMutation.mutate({
                    next: tokens,
                    note: note.trim() || undefined,
                  });
                }}
              >
                <Sparkles size={14} /> Save Draft
              </Button>
            </>
          ) : null}
          {canPublish ? (
            <Button
              type="button"
              variant="primary"
              disabled={
                Boolean(aiPreview) ||
                saveDraftMutation.isPending ||
                saveAndPublishMutation.isPending
              }
              onClick={() => {
                if (!validateDraft()) return;
                saveAndPublishMutation.mutate({
                  next: tokens,
                  note: note.trim() || undefined,
                });
              }}
            >
              <Check size={14} /> Save &amp; Publish
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <div className="typo-ai-error">{error}</div> : null}

      <div className="theme-settings-shell">
        <aside className="theme-settings-nav" aria-label="Theme Settings Navigation">
          <div className="theme-nav-heading">Theme Settings</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "theme-nav-item",
                  section === item.id && "active"
                )}
                onClick={() => setSection(item.id)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="theme-main-stage">
          {section === "colors" ? (
            <div className="theme-panel-stack">
              <div className="theme-section-head">
                <div>
                  <h2>Global Colors</h2>
                  <p>
                    Core brand color tokens and extensible Brand Palette swatches used across typography and page elements.
                  </p>
                </div>
              </div>
              <div className="theme-color-grid">
                {(
                  [
                    ["primary", "Primary Brand"],
                    ["secondary", "Secondary Surface Dark"],
                    ["background", "Store Background"],
                    ["surface", "Card / Subtle Surface"],
                    ["text", "Primary Text"],
                    ["muted", "Muted Text"],
                    ["accent", "Accent Highlight"],
                    ["border", "Hairline Border"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="theme-card-box">
                    <ColorControl
                      label={label}
                      value={effectiveTokens.colors[key] || ""}
                      placeholder="#111318"
                      palette={palette}
                      displayMode="inline"
                      onAddPaletteColor={handleAddBrandColor}
                      onChange={(hex) =>
                        commitTokensChange(
                          {
                            ...tokens,
                            colors: { ...tokens.colors, [key]: hex },
                          },
                          `Update ${label} color`
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {section === "typography" ? (
            <div className="typo-workspace">
              <div className="typo-workspace-head">
                <div className="typo-subtab-nav" role="tablist">
                  {(
                    [
                      ["presets", "Typography Presets & Studio"],
                      ["fonts", "Font Families (5)"],
                      ["specimen", "Live Storefront Specimen"],
                    ] as const
                  ).map(([tabKey, tabLabel]) => (
                    <button
                      key={tabKey}
                      type="button"
                      role="tab"
                      aria-selected={typoSubTab === tabKey}
                      className={cn(
                        "typo-subtab-btn",
                        typoSubTab === tabKey && "active"
                      )}
                      onClick={() => setTypoSubTab(tabKey)}
                    >
                      {tabLabel}
                    </button>
                  ))}
                </div>

                <Popover open={resetAllOpen} onOpenChange={setResetAllOpen}>
                  <PopoverTrigger
                    disabled={!canWrite || Boolean(aiPreview)}
                    className="btn btn-sm"
                  >
                    <RotateCcw size={12} />
                    <span>Reset All Typography</span>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-[280px]">
                    <PopoverHeader>
                      <PopoverTitle>Reset Global Typography?</PopoverTitle>
                      <PopoverDescription>
                        Restores all font roles and built-in presets to factory defaults (reversible with Undo).
                      </PopoverDescription>
                    </PopoverHeader>
                    <div className="button-row" style={{ justifyContent: "flex-end" }}>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setResetAllOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          commitTokensChange(
                            { ...tokens, typography: resetAllTypography() },
                            "Reset all Global Typography"
                          );
                          setResetAllOpen(false);
                          notify("Reset Global Typography to defaults");
                        }}
                      >
                        Confirm Reset
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <TypographyAiBar
                tokens={effectiveTokens}
                viewport={viewport}
                disabled={!canWrite}
                aiPreview={aiPreview}
                canUndo={canUndo}
                onUndoLastAi={handleUndo}
                onStartPreview={(nextPreview) => setAiPreview(nextPreview)}
                onToggleViewMode={(viewMode) =>
                  setAiPreview((curr) => (curr ? { ...curr, viewMode } : null))
                }
                onApplyPreview={() => {
                  if (!aiPreview) return;
                  commitTokensChange(
                    aiPreview.previewTokens,
                    `AI: ${aiPreview.summary}`,
                    "ai"
                  );
                  setAiPreview(null);
                  notify(`Applied AI typography draft: ${aiPreview.summary}`);
                }}
                onRejectPreview={() => {
                  setAiPreview(null);
                  notify("Discarded AI typography preview");
                }}
              />

              <div className="typo-subtab-stage">
                {typoSubTab === "presets" ? (
                  <TypographyPresetsPanel
                    tokens={effectiveTokens}
                    typography={normalizedTypography}
                    selectedPresetId={selectedPresetId}
                    onSelectPreset={setSelectedPresetId}
                    viewport={viewport}
                    onViewportChange={setViewport}
                    disabled={!canWrite || Boolean(aiPreview)}
                    onChangeTypography={(nextTypo, summary) =>
                      handleChangeTypography(nextTypo, summary)
                    }
                    onAddBrandColor={handleAddBrandColor}
                    onNotify={notify}
                  />
                ) : null}

                {typoSubTab === "fonts" ? (
                  <FontFamiliesPanel
                    typography={normalizedTypography}
                    disabled={!canWrite || Boolean(aiPreview)}
                    onUpdateFontRole={handleUpdateFontRole}
                    onNotify={notify}
                  />
                ) : null}

                {typoSubTab === "specimen" ? (
                  <TypographyPreviewPanel
                    typography={normalizedTypography}
                    colors={effectiveTokens.colors}
                    viewport={viewport}
                    onViewportChange={setViewport}
                    selectedPresetId={selectedPresetId}
                    onSelectPreset={(id) => {
                      setSelectedPresetId(id);
                      setTypoSubTab("presets");
                    }}
                    affectedPresets={aiPreview?.affectedPresets}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {section === "layout" ? (
            <div className="theme-panel-stack">
              <div className="theme-section-head">
                <div>
                  <h2>Global Layout</h2>
                  <p>Storefront page width constraints and responsive frame boundaries.</p>
                </div>
              </div>
              <div className="theme-card-box">
                <div className="typo-field-group">
                  <span className="typo-field-label">
                    Container Max Width (1024px–1536px)
                  </span>
                  <input
                    type="text"
                    disabled={!canWrite}
                    value={tokens.container.maxWidth}
                    onChange={(e) =>
                      commitTokensChange(
                        {
                          ...tokens,
                          container: { maxWidth: e.target.value },
                        },
                        "Update container maxWidth"
                      )
                    }
                    className="typo-text-input"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {section === "spacing" ? (
            <div className="theme-panel-stack">
              <div className="theme-section-head">
                <div>
                  <h2>Global Spacing</h2>
                  <p>Vertical section rhythm and block gap design tokens.</p>
                </div>
              </div>
              <div className="theme-two-grid">
                <div className="theme-card-box">
                  <div className="typo-field-group">
                    <span className="typo-field-label">Section Vertical Rhythm (sectionY)</span>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={tokens.spacing?.sectionY || "64px"}
                      onChange={(e) =>
                        commitTokensChange(
                          {
                            ...tokens,
                            spacing: {
                              ...tokens.spacing,
                              sectionY: e.target.value,
                            },
                          },
                          "Update spacing sectionY"
                        )
                      }
                      className="typo-text-input"
                    />
                  </div>
                </div>
                <div className="theme-card-box">
                  <div className="typo-field-group">
                    <span className="typo-field-label">Block Gap (blockGap)</span>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={tokens.spacing?.blockGap || "24px"}
                      onChange={(e) =>
                        commitTokensChange(
                          {
                            ...tokens,
                            spacing: {
                              ...tokens.spacing,
                              blockGap: e.target.value,
                            },
                          },
                          "Update spacing blockGap"
                        )
                      }
                      className="typo-text-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {section === "buttons" ? (
            <div className="theme-panel-stack">
              <div className="theme-section-head">
                <div>
                  <h2>Global Buttons</h2>
                  <p>
                    Border radius and interactive typography inherited by primary storefront buttons.
                  </p>
                </div>
              </div>
              <div className="theme-two-grid">
                <div className="theme-card-box">
                  <div className="typo-field-group">
                    <span className="typo-field-label">Button Radius (px)</span>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={tokens.radius.button}
                      onChange={(e) =>
                        commitTokensChange(
                          {
                            ...tokens,
                            radius: { ...tokens.radius, button: e.target.value },
                          },
                          "Update button radius"
                        )
                      }
                      className="typo-text-input"
                    />
                  </div>
                  {buttonPreset ? (
                    <div className="typo-btn-link-card">
                      <span>
                        Button Text Style:{" "}
                        <strong>{buttonPreset.fontFamily}</strong> ·{" "}
                        {typeof buttonPreset.fontSize === "string"
                          ? buttonPreset.fontSize
                          : buttonPreset.fontSize.desktop}{" "}
                        · w{buttonPreset.fontWeight}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelectedPresetId("button");
                          setSection("typography");
                          setTypoSubTab("presets");
                        }}
                      >
                        Edit Button Typography
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="theme-card-box">
                  <span className="typo-field-label">Button Token Preview</span>
                  <div className="typo-btn-preview-box" style={{ background: effectiveTokens.colors.surface }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: effectiveTokens.colors.primary,
                        color: "#FFFFFF",
                        borderColor: effectiveTokens.colors.primary,
                        borderRadius: effectiveTokens.radius.button,
                        fontFamily: formatCssFontStack(
                          normalizedTypography.fonts.primary.family,
                          normalizedTypography.fonts.primary.fallback
                        ),
                      }}
                    >
                      Shop Collection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {section === "components" ? (
            <div className="theme-panel-stack">
              <div className="theme-section-head">
                <div>
                  <h2>Global Components &amp; Versions</h2>
                  <p>Card radii, elevation shadows, and CMS theme version rollback history.</p>
                </div>
              </div>
              <div className="theme-two-grid">
                <div className="theme-card-box">
                  <div className="typo-field-group">
                    <span className="typo-field-label">Card Radius (0px–24px)</span>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={tokens.radius.card}
                      onChange={(e) =>
                        commitTokensChange(
                          {
                            ...tokens,
                            radius: { ...tokens.radius, card: e.target.value },
                          },
                          "Update card radius"
                        )
                      }
                      className="typo-text-input"
                    />
                  </div>
                </div>
                <div className="theme-card-box">
                  <div className="typo-field-group">
                    <span className="typo-field-label">Card Box Shadow</span>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={tokens.shadows?.card || ""}
                      onChange={(e) =>
                        commitTokensChange(
                          {
                            ...tokens,
                            shadows: {
                              ...tokens.shadows,
                              card: e.target.value,
                            },
                          },
                          "Update card shadow"
                        )
                      }
                      className="typo-text-input"
                    />
                  </div>
                </div>
              </div>
              <DataTable
                title="Theme version history"
                columns={columns}
                data={data.versions}
                getRowKey={(ver) => ver.id}
                pageSize={8}
              />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function ThemeSettingsView({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const canPublish = hasPermission("content:publish");

  const themeQuery = useQuery({
    queryKey: ["admin-theme"],
    queryFn: () => cmsAdminApi.getTheme(),
  });

  if (themeQuery.isLoading) return <Skeleton rows={4} />;
  if (themeQuery.isError || !themeQuery.data) {
    return (
      <Empty
        icon={<Palette size={22} />}
        title="Could not load theme settings"
        text={
          themeQuery.error instanceof ApiError
            ? themeQuery.error.message
            : "Failed to load theme versions."
        }
      />
    );
  }

  return (
    <ThemeWorkspace
      data={themeQuery.data}
      canWrite={canWrite}
      canPublish={canPublish}
      notify={notify}
    />
  );
}
