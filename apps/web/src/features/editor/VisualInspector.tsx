"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BoxSelect,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  Lock,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Trash2,
  Unlock,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  buildBackgroundImageCss,
  parseBackgroundImage,
} from "@/features/builder/background-image";
import {
  canAcceptChild,
  createElementId,
  findNode,
} from "@/features/builder/operations";
import { getElementPart, getElementParts } from "@/features/builder/parts";
import {
  ELEMENT_DEFINITIONS,
  createElementNode,
} from "@/features/builder/registry/definitions";
import { BUILDER_ICON_MAP } from "@/features/builder/registry/elements";
import {
  isValidCssClass,
  sanitizeHtmlSubset,
} from "@/features/builder/sanitizers";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { resolveStylesForViewport } from "@/features/builder/style-compiler";
import type {
  ElementItemData,
  ElementNode,
  FormFieldData,
  StylePropertyKey,
  StyleValues,
  ViewportMode,
} from "@/features/builder/types";
import { ALLOWED_FONTS } from "@/lib/cms-schema";
import { ApiError } from "@/lib/api-client";
import { adminMediaApi } from "@/lib/commerce-api";
import { cn } from "@/lib/format";
import type { CategoryDto, ProductDto } from "@/types/api-commerce";
import type { ThemeTokens } from "@/types/api-cms-ai";
import { MediaPickerModal } from "./MediaPickerModal";
import {
  createCustomPaletteColor,
  getBrandPaletteOptions,
  isValidHex6,
  normalizeHexColor,
  type BrandPaletteOption,
} from "./brand-palette";
import {
  BackgroundImageControl,
  ColorControl,
  ControlField,
  PropertyPopoverRow,
  SelectControl,
  SliderControl,
  SpacingBoxControl,
  UnitControl,
} from "./inspector-controls";

type InspectorTab = "content" | "layout" | "style" | "advanced";

const GRADIENT_PRESETS: { label: string; value: string }[] = [
  { label: "None", value: "" },
  {
    label: "Alpine Dusk",
    value: "linear-gradient(135deg, #0F291E 0%, #1F2937 100%)",
  },
  {
    label: "Midnight Slate",
    value: "linear-gradient(135deg, #111318 0%, #1E293B 100%)",
  },
  {
    label: "Indigo Mist",
    value: "linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)",
  },
  {
    label: "Warm Paper",
    value: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
  },
];

const SHADOW_PRESETS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "0 1px 3px rgba(15, 23, 42, 0.08)", label: "Subtle" },
  { value: "0 6px 18px rgba(15, 23, 42, 0.1)", label: "Card" },
  { value: "0 16px 36px rgba(15, 23, 42, 0.16)", label: "Elevated" },
];

const FONT_OPTIONS = ALLOWED_FONTS.map((f) => ({ value: f, label: f }));
const ICON_OPTIONS = Object.keys(BUILDER_ICON_MAP).map((key) => ({
  value: key,
  label: key,
}));

function GlobalThemePanel({
  tokens,
  dirty,
  canWrite,
  canPublish,
  savingTheme,
  publishingTheme,
  onChangeTokens,
  onSaveTheme,
  onPublishTheme,
  onAddBrandColor,
  onRemoveBrandColor,
}: {
  tokens: ThemeTokens;
  dirty: boolean;
  canWrite: boolean;
  canPublish: boolean;
  savingTheme: boolean;
  publishingTheme: boolean;
  onChangeTokens: (next: ThemeTokens) => void;
  onSaveTheme: () => void;
  onPublishTheme: () => void;
  onAddBrandColor?: (name: string, hex: string) => void;
  onRemoveBrandColor?: (id: string) => void;
}) {
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandHex, setNewBrandHex] = useState("#C85A32");
  const [paletteErr, setPaletteErr] = useState("");

  const updateColor = (key: keyof ThemeTokens["colors"], val: string) => {
    onChangeTokens({
      ...tokens,
      colors: {
        ...tokens.colors,
        [key]: val,
      },
    });
  };

  const handleAddSwatch = () => {
    const cleanName = newBrandName.trim();
    if (!cleanName) {
      setPaletteErr("Enter a color name.");
      return;
    }
    if (!isValidHex6(newBrandHex)) {
      setPaletteErr("Enter a 6-digit hex code (e.g. #C85A32).");
      return;
    }
    onAddBrandColor?.(cleanName, normalizeHexColor(newBrandHex));
    setNewBrandName("");
    setPaletteErr("");
  };

  return (
    <div className="ed-inspector-scroll">
      <div className="ed-inspector-section">
        <div className="ed-inspector-sec-head">
          <strong>Brand Palette</strong>
          {dirty ? <Badge tone="accent">Unsaved</Badge> : null}
        </div>
        <div className="ed-control-stack">
          <ColorControl
            label="Primary Brand"
            value={tokens.colors.primary}
            onChange={(v) => updateColor("primary", v)}
          />
          <ColorControl
            label="Secondary"
            value={tokens.colors.secondary || "#1F2937"}
            onChange={(v) => updateColor("secondary", v)}
          />
          <ColorControl
            label="Accent"
            value={tokens.colors.accent || "#18794E"}
            onChange={(v) => updateColor("accent", v)}
          />
          <ColorControl
            label="Page Background"
            value={tokens.colors.background}
            onChange={(v) => updateColor("background", v)}
          />
          <ColorControl
            label="Surface"
            value={tokens.colors.surface || "#F8FAFC"}
            onChange={(v) => updateColor("surface", v)}
          />
          <ColorControl
            label="Body Text"
            value={tokens.colors.text}
            onChange={(v) => updateColor("text", v)}
          />
          <ColorControl
            label="Muted Text"
            value={tokens.colors.muted || "#5C6270"}
            onChange={(v) => updateColor("muted", v)}
          />
          <ColorControl
            label="Border"
            value={tokens.colors.border || "#E5E7EB"}
            onChange={(v) => updateColor("border", v)}
          />
        </div>

        <div className="ed-custom-palette-block">
          <div className="ed-ctrl-head">
            <span className="ed-ctrl-label">
              Custom Brand Colors ({tokens.customPalette?.length || 0})
            </span>
          </div>
          {(tokens.customPalette || []).length > 0 ? (
            <div className="ed-custom-palette-list">
              {(tokens.customPalette || []).map((swatch) => (
                <div key={swatch.id} className="ed-custom-palette-row">
                  <span
                    className="ed-custom-palette-dot"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className="ed-custom-palette-name">{swatch.name}</span>
                  <code className="ed-custom-palette-hex">{swatch.hex}</code>
                  {canWrite && onRemoveBrandColor ? (
                    <button
                      type="button"
                      className="ed-attr-row-remove"
                      aria-label={`Remove ${swatch.name} from Brand Palette`}
                      onClick={() => onRemoveBrandColor(swatch.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="ed-hint">
              Add reusable brand colors below to surface them first in every color picker.
            </p>
          )}
          {canWrite && onAddBrandColor ? (
            <div className="ed-palette-add-form">
              <div className="ed-palette-add-inputs">
                <input
                  type="text"
                  aria-label="Global brand color name"
                  placeholder="Color name (e.g. Terracotta)"
                  maxLength={32}
                  value={newBrandName}
                  onChange={(e) => {
                    setNewBrandName(e.target.value);
                    if (paletteErr) setPaletteErr("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSwatch();
                    }
                  }}
                />
                <input
                  type="color"
                  aria-label="Global brand color picker"
                  value={isValidHex6(newBrandHex) ? normalizeHexColor(newBrandHex) : "#C85A32"}
                  onChange={(e) => {
                    setNewBrandHex(e.target.value.toUpperCase());
                    if (paletteErr) setPaletteErr("");
                  }}
                />
                <input
                  type="text"
                  aria-label="Global brand color hex"
                  value={newBrandHex}
                  onChange={(e) => {
                    setNewBrandHex(e.target.value);
                    if (paletteErr) setPaletteErr("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSwatch();
                    }
                  }}
                />
              </div>
              {paletteErr ? <small className="ed-palette-error">{paletteErr}</small> : null}
              <Button size="sm" onClick={handleAddSwatch}>
                <Plus size={12} /> Add to Brand Palette
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ed-inspector-section">
        <strong>Typography & Radii</strong>
        <div className="ed-control-stack">
          <SelectControl
            label="Heading Font"
            value={tokens.typography.headingFont}
            options={FONT_OPTIONS}
            onChange={(v) =>
              onChangeTokens({
                ...tokens,
                typography: { ...tokens.typography, headingFont: v },
              })
            }
          />
          <SelectControl
            label="Body Font"
            value={tokens.typography.bodyFont}
            options={FONT_OPTIONS}
            onChange={(v) =>
              onChangeTokens({
                ...tokens,
                typography: { ...tokens.typography, bodyFont: v },
              })
            }
          />
          <div className="ed-control-grid-2">
            <UnitControl
              label="Card Radius"
              value={tokens.radius.card}
              onChange={(v) =>
                onChangeTokens({
                  ...tokens,
                  radius: { ...tokens.radius, card: v || "10px" },
                })
              }
            />
            <UnitControl
              label="Button Radius"
              value={tokens.radius.button}
              onChange={(v) =>
                onChangeTokens({
                  ...tokens,
                  radius: { ...tokens.radius, button: v || "8px" },
                })
              }
            />
          </div>
          <UnitControl
            label="Container Max Width"
            value={tokens.container.maxWidth}
            onChange={(v) =>
              onChangeTokens({
                ...tokens,
                container: { maxWidth: v || "1280px" },
              })
            }
          />
          <div className="ed-control-grid-2">
            <UnitControl
              label="Section Spacing Y"
              value={tokens.spacing?.sectionY || "64px"}
              onChange={(v) =>
                onChangeTokens({
                  ...tokens,
                  spacing: {
                    ...(tokens.spacing || {}),
                    sectionY: v || "64px",
                  },
                })
              }
            />
            <UnitControl
              label="Block Gap"
              value={tokens.spacing?.blockGap || "24px"}
              onChange={(v) =>
                onChangeTokens({
                  ...tokens,
                  spacing: {
                    ...(tokens.spacing || {}),
                    blockGap: v || "24px",
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="ed-inspector-section">
        <div className="ed-theme-actions">
          <Button
            size="sm"
            disabled={!canWrite || !dirty || savingTheme}
            onClick={onSaveTheme}
          >
            <Save size={13} />
            {savingTheme ? "Saving..." : "Save Theme Draft"}
          </Button>
          {canPublish ? (
            <Button
              size="sm"
              variant="primary"
              disabled={publishingTheme}
              onClick={onPublishTheme}
            >
              {publishingTheme ? "Publishing..." : "Publish Theme"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BulkMultiSelectPanel({
  selectedNodes,
  viewport,
  palette,
  onAddPaletteColor,
  onDuplicateAll,
  onDeleteAll,
  onWrapInContainer,
  onApplyBatchStyles,
}: {
  selectedNodes: ElementNode[];
  viewport: ViewportMode;
  palette: BrandPaletteOption[];
  onAddPaletteColor?: (name: string, hex: string) => void;
  onDuplicateAll: () => void;
  onDeleteAll: () => void;
  onWrapInContainer: () => void;
  onApplyBatchStyles: (styles: StyleValues) => void;
}) {
  const [batchColor, setBatchColor] = useState("#111318");
  const [batchBg, setBatchBg] = useState("#FFFFFF");
  const [batchPadding, setBatchPadding] = useState("16px");
  const [batchRadius, setBatchRadius] = useState("10px");

  return (
    <div className="ed-inspector-scroll">
      <div className="ed-inspector-section">
        <div className="ed-inspector-sec-head">
          <strong>{selectedNodes.length} elements selected</strong>
          <Badge tone="accent">{viewport}</Badge>
        </div>
        <div className="ed-multi-chips">
          {selectedNodes.map((n) => (
            <Badge key={n.id} tone="neutral">
              {n.label}
            </Badge>
          ))}
        </div>
        <div className="ed-bulk-actions">
          <Button size="sm" onClick={onWrapInContainer}>
            <BoxSelect size={13} /> Wrap in Container
          </Button>
          <Button size="sm" onClick={onDuplicateAll}>
            <Copy size={13} /> Duplicate
          </Button>
          <Button size="sm" variant="destructive" onClick={onDeleteAll}>
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </div>

      <div className="ed-inspector-section">
        <strong>Batch Style Overrides</strong>
        <div className="ed-control-stack">
          <ColorControl
            label="Text Color"
            value={batchColor}
            palette={palette}
            onAddPaletteColor={onAddPaletteColor}
            onChange={(v) => {
              setBatchColor(v);
              onApplyBatchStyles({ color: v });
            }}
          />
          <ColorControl
            label="Background Color"
            value={batchBg}
            palette={palette}
            onAddPaletteColor={onAddPaletteColor}
            onChange={(v) => {
              setBatchBg(v);
              onApplyBatchStyles({ backgroundColor: v });
            }}
          />
          <div className="ed-control-grid-2">
            <UnitControl
              label="Padding"
              value={batchPadding}
              onChange={(v) => {
                setBatchPadding(v);
                onApplyBatchStyles({ padding: v });
              }}
            />
            <UnitControl
              label="Radius"
              value={batchRadius}
              onChange={(v) => {
                setBatchRadius(v);
                onApplyBatchStyles({ borderRadius: v });
              }}
            />
          </div>
          <SelectControl
            label="Text Alignment"
            value="left"
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
            onChange={(v) => onApplyBatchStyles({ textAlign: v })}
          />
        </div>
      </div>
    </div>
  );
}

function ItemsRepeaterControl({
  items,
  includeImage = false,
  onChange,
}: {
  items: ElementItemData[];
  includeImage?: boolean;
  onChange: (next: ElementItemData[]) => void;
}) {
  const move = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [picked] = copy.splice(idx, 1);
    copy.splice(target, 0, picked);
    onChange(copy);
  };

  return (
    <div className="ed-repeater">
      {items.map((item, idx) => (
        <div key={item.id} className="ed-repeater-card">
          <div className="ed-repeater-head">
            <strong>Item {idx + 1}</strong>
            <div className="ed-repeater-btns">
              <IconButton
                label="Move item up"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
              >
                <ArrowUp size={11} />
              </IconButton>
              <IconButton
                label="Move item down"
                disabled={idx === items.length - 1}
                onClick={() => move(idx, 1)}
              >
                <ArrowDown size={11} />
              </IconButton>
              <IconButton
                label="Delete item"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                <Trash2 size={11} />
              </IconButton>
            </div>
          </div>
          <input
            type="text"
            placeholder="Title"
            value={item.title}
            onChange={(e) =>
              onChange(
                items.map((it, i) =>
                  i === idx ? { ...it, title: e.target.value } : it
                )
              )
            }
          />
          <textarea
            rows={2}
            placeholder="Body copy"
            value={item.body || ""}
            onChange={(e) =>
              onChange(
                items.map((it, i) =>
                  i === idx ? { ...it, body: e.target.value } : it
                )
              )
            }
          />
          {includeImage ? (
            <input
              type="text"
              placeholder="Image URL (/media/... or https://...)"
              value={item.image || ""}
              onChange={(e) =>
                onChange(
                  items.map((it, i) =>
                    i === idx ? { ...it, image: e.target.value } : it
                  )
                )
              }
            />
          ) : null}
        </div>
      ))}
      <Button
        size="sm"
        onClick={() =>
          onChange([
            ...items,
            {
              id: createElementId("item"),
              title: `New item ${items.length + 1}`,
              body: "Describe details here.",
              ...(includeImage ? { image: "/media/terrain-fallback.jpg" } : {}),
            },
          ])
        }
      >
        <Plus size={12} /> Add Item
      </Button>
    </div>
  );
}

type MediaPickerTarget =
  | {
      kind: "background";
      nodeId: string;
      nodeLabel: string;
      partKey: string | null;
      partLabel: string | null;
      breakpoint: "base" | "tablet" | "mobile" | "hover";
      currentBg: string;
      backgroundColor?: string;
      hasSize: boolean;
      hasPosition: boolean;
      hasRepeat: boolean;
    }
  | {
      kind: "prop";
      nodeId: string;
      propKey: string;
      currentUrl: string;
    };

export function VisualInspector({
  products,
  categories,
  canWrite,
  canPublish,
  canUploadMedia = false,
  savingTheme,
  publishingTheme,
  onSaveTheme,
  onPublishTheme,
  onAddBrandColor,
  onRemoveBrandColor,
  onNotify,
}: {
  products: ProductDto[];
  categories: CategoryDto[];
  canWrite: boolean;
  canPublish: boolean;
  canUploadMedia?: boolean;
  savingTheme: boolean;
  publishingTheme: boolean;
  onSaveTheme: () => void;
  onPublishTheme: () => void;
  onAddBrandColor?: (name: string, hex: string) => void;
  onRemoveBrandColor?: (id: string) => void;
  onNotify?: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InspectorTab>("content");
  const [inspectGlobalTheme, setInspectGlobalTheme] = useState(false);
  const [newClassInput, setNewClassInput] = useState("");
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");
  const [editHoverState, setEditHoverState] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<MediaPickerTarget | null>(null);

  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedPart = useEditorStore((s) => s.selectedPart);
  const viewport = useEditorStore((s) => s.viewport);
  const themeTokens = useEditorStore((s) => s.themeTokens);
  const themeDirty = useEditorStore((s) => s.themeDirty);
  const setThemeTokens = useEditorStore((s) => s.setThemeTokens);
  const selectPart = useEditorStore((s) => s.selectPart);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const resetNodeStyleKeys = useEditorStore((s) => s.resetNodeStyleKeys);
  const updateNodePartStyles = useEditorStore((s) => s.updateNodePartStyles);
  const resetNodePartStyleKeys = useEditorStore((s) => s.resetNodePartStyleKeys);
  const toggleNodeVisibility = useEditorStore((s) => s.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((s) => s.toggleNodeLock);
  const executeOperation = useEditorStore((s) => s.executeOperation);
  const executeBatch = useEditorStore((s) => s.executeBatch);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);

  const brandPalette = getBrandPaletteOptions(themeTokens);

  const handleFallbackAddPalette = (name: string, hex: string) => {
    if (onAddBrandColor) {
      onAddBrandColor(name, hex);
      return;
    }
    if (!themeTokens || !canWrite) return;
    const existing = themeTokens.customPalette || [];
    if (existing.length >= 24) return;
    const entry = createCustomPaletteColor(name, hex, existing);
    setThemeTokens({ ...themeTokens, customPalette: [...existing, entry] }, true);
  };

  const quickUploadMutation = useMutation({
    mutationFn: async (vars: {
      file: File;
      target: MediaPickerTarget;
    }) => {
      const uploaded = await adminMediaApi.upload(vars.file, vars.file.name);
      return { uploaded, target: vars.target };
    },
    onSuccess: ({ uploaded, target }) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      applySelectedMediaUrl(target, uploaded.url);
      onNotify?.(`Uploaded ${uploaded.originalFilename}`);
    },
    onError: (err) => {
      onNotify?.(err instanceof ApiError ? err.message : "Failed to upload image");
    },
  });

  const applySelectedMediaUrl = (target: MediaPickerTarget, url: string) => {
    if (target.kind === "prop") {
      updateNodeProps(target.nodeId, { [target.propKey]: url });
      return;
    }
    const parsed = parseBackgroundImage(
      target.currentBg,
      target.backgroundColor || "#111318"
    );
    const nextBg = buildBackgroundImageCss({
      imageUrl: url,
      imageOpacity: parsed.imageOpacity,
      overlayColor: parsed.overlayColor,
    });
    if (!nextBg) return;
    const patch: StyleValues = { backgroundImage: nextBg };
    if (!target.hasSize) patch.backgroundSize = "cover";
    if (!target.hasPosition) patch.backgroundPosition = "center";
    if (!target.hasRepeat) patch.backgroundRepeat = "no-repeat";
    if (target.partKey && target.partLabel) {
      updateNodePartStyles(
        target.nodeId,
        target.partKey,
        patch,
        target.breakpoint,
        `Update background image on ${target.nodeLabel} › ${target.partLabel}`
      );
    } else {
      updateNodeStyles(
        target.nodeId,
        patch,
        target.breakpoint,
        `Update background image on ${target.nodeLabel}`
      );
    }
  };

  const selectedNodes = selectedIds
    .map((id) => findNode(nodes, id))
    .filter((n): n is ElementNode => Boolean(n));

  const primary = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const activeBreakpoint =
    editHoverState && tab === "style" ? "hover" : viewport === "desktop" ? "base" : viewport;

  const showThemeView = inspectGlobalTheme || selectedNodes.length === 0;

  const productOptions = [
    { value: "", label: "Auto (first catalog item)" },
    ...products.slice(0, 40).map((p) => ({ value: p.slug, label: p.name })),
  ];
  const categoryOptions = [
    { value: "", label: "All categories" },
    ...categories.map((c) => ({ value: c.slug, label: c.name })),
  ];

  return (
    <aside className="ed-right-inspector" aria-label="Visual Inspector">
      <div className="ed-inspector-mode-bar">
        <button
          type="button"
          className={cn("ed-mode-pill", !showThemeView && "active")}
          disabled={selectedNodes.length === 0}
          onClick={() => setInspectGlobalTheme(false)}
        >
          <Sliders size={12} />
          <span>Element</span>
        </button>
        <button
          type="button"
          className={cn("ed-mode-pill", showThemeView && "active")}
          onClick={() => setInspectGlobalTheme(true)}
        >
          <Palette size={12} />
          <span>Design Tokens</span>
        </button>
      </div>

      {showThemeView && themeTokens ? (
        <GlobalThemePanel
          tokens={themeTokens}
          dirty={themeDirty}
          canWrite={canWrite}
          canPublish={canPublish}
          savingTheme={savingTheme}
          publishingTheme={publishingTheme}
          onChangeTokens={(next) => setThemeTokens(next, true)}
          onSaveTheme={onSaveTheme}
          onPublishTheme={onPublishTheme}
          onAddBrandColor={onAddBrandColor || handleFallbackAddPalette}
          onRemoveBrandColor={onRemoveBrandColor}
        />
      ) : selectedNodes.length > 1 ? (
        <BulkMultiSelectPanel
          selectedNodes={selectedNodes}
          viewport={viewport}
          palette={brandPalette}
          onAddPaletteColor={canWrite ? handleFallbackAddPalette : undefined}
          onDuplicateAll={duplicateSelected}
          onDeleteAll={deleteSelected}
          onWrapInContainer={() => {
            const wrapper = createElementNode("container");
            wrapper.label = "Grouped Container";
            executeOperation(
              {
                type: "wrap_nodes",
                nodeIds: selectedNodes.map((n) => n.id),
                wrapper,
              },
              { summary: `Wrap ${selectedNodes.length} elements`, nextSelectedIds: [wrapper.id] }
            );
          }}
          onApplyBatchStyles={(styles) => {
            const bp = viewport === "desktop" ? "base" : viewport;
            executeBatch(
              selectedNodes
                .filter((n) => !n.locked)
                .map((n) => ({
                  type: "update_styles",
                  nodeId: n.id,
                  breakpoint: bp,
                  styles,
                })),
              { summary: `Batch style ${selectedNodes.length} elements` }
            );
          }}
        />
      ) : primary ? (
        (() => {
          const def = ELEMENT_DEFINITIONS[primary.type];
          const primaryParts = getElementParts(primary.type);
          const activePartKey =
            selectedPart?.nodeId === primary.id ? selectedPart.partKey : null;
          const activePartDef = activePartKey
            ? getElementPart(primary.type, activePartKey)
            : null;
          const editedResponsiveStyles = activePartKey
            ? primary.partStyles?.[activePartKey]
            : primary.styles;
          const { resolved, overriddenKeys, hasViewportOverride } =
            resolveStylesForViewport(editedResponsiveStyles, viewport);
          const editStyles: StyleValues =
            editHoverState && tab === "style"
              ? editedResponsiveStyles?.hover || {}
              : resolved;

          const setStyle = (key: StylePropertyKey, val: string) => {
            if (activePartKey && activePartDef) {
              updateNodePartStyles(
                primary.id,
                activePartKey,
                { [key]: val },
                activeBreakpoint,
                `Update ${key} on ${primary.label} › ${activePartDef.label}`
              );
              return;
            }
            updateNodeStyles(
              primary.id,
              { [key]: val },
              activeBreakpoint,
              `Update ${key} on ${primary.label}`
            );
          };
          const setStyleBatch = (patch: StyleValues) => {
            if (activePartKey && activePartDef) {
              updateNodePartStyles(
                primary.id,
                activePartKey,
                patch,
                activeBreakpoint,
                `Update background on ${primary.label} › ${activePartDef.label}`
              );
              return;
            }
            updateNodeStyles(
              primary.id,
              patch,
              activeBreakpoint,
              `Update background on ${primary.label}`
            );
          };
          const resetKey = (key: StylePropertyKey) => {
            if (activePartKey) {
              if (activeBreakpoint === "base") {
                updateNodePartStyles(
                  primary.id,
                  activePartKey,
                  { [key]: "" },
                  "base"
                );
              } else {
                resetNodePartStyleKeys(
                  primary.id,
                  activePartKey,
                  [key],
                  activeBreakpoint
                );
              }
              return;
            }
            if (activeBreakpoint === "base") {
              updateNodeStyles(primary.id, { [key]: "" }, "base");
            } else {
              resetNodeStyleKeys(primary.id, [key], activeBreakpoint);
            }
          };

          const opacityNum =
            editStyles.opacity !== undefined && editStyles.opacity !== ""
              ? Math.max(0, Math.min(1, Number(editStyles.opacity)))
              : 1;

          return (
            <>
              <div className="ed-selected-banner">
                <div className="ed-selected-title">
                  <strong>{primary.label}</strong>
                  <span>
                    {def?.label || primary.type}
                    {activePartDef ? ` › ${activePartDef.label}` : ""}
                  </span>
                </div>
                <div className="ed-selected-quick">
                  <IconButton
                    label={primary.visible ? "Hide" : "Show"}
                    onClick={() => toggleNodeVisibility(primary.id)}
                  >
                    {primary.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </IconButton>
                  <IconButton
                    label={primary.locked ? "Unlock" : "Lock"}
                    onClick={() => toggleNodeLock(primary.id)}
                  >
                    {primary.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </IconButton>
                  <IconButton
                    label="Duplicate element"
                    disabled={primary.locked}
                    onClick={() =>
                      executeOperation(
                        { type: "duplicate_node", nodeId: primary.id },
                        { summary: `Duplicate ${primary.label}` }
                      )
                    }
                  >
                    <Copy size={13} />
                  </IconButton>
                  <IconButton
                    label="Delete element"
                    disabled={primary.locked}
                    onClick={() =>
                      executeOperation(
                        { type: "delete_node", nodeId: primary.id },
                        { summary: `Delete ${primary.label}`, nextSelectedIds: [] }
                      )
                    }
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>

              {primaryParts.length ? (
                <div className="ed-part-strip" aria-label="Inner elements">
                  <button
                    type="button"
                    className={cn("ed-part-chip", !activePartKey && "active")}
                    onClick={() => selectPart(primary.id, null)}
                  >
                    Whole Element
                  </button>
                  {primaryParts.map((part) => {
                    const partResp = primary.partStyles?.[part.key];
                    const hasCustom = Boolean(
                      partResp &&
                        (["base", "tablet", "mobile", "hover"] as const).some(
                          (bp) => Object.keys(partResp[bp] || {}).length > 0
                        )
                    );
                    return (
                      <button
                        key={part.key}
                        type="button"
                        className={cn(
                          "ed-part-chip",
                          activePartKey === part.key && "active",
                          hasCustom && "has-custom"
                        )}
                        title={
                          part.repeating
                            ? `${part.label} (edits sync across all repeating items)`
                            : part.label
                        }
                        onClick={() => {
                          selectPart(primary.id, part.key);
                          if (tab === "content" || tab === "advanced") {
                            setTab("style");
                          }
                        }}
                      >
                        <span>{part.label}</span>
                        {part.repeating ? <span aria-hidden="true">↻</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {activePartDef ? (
                <div className="ed-part-sync-note">
                  <span>
                    {activePartDef.repeating
                      ? `Editing ${activePartDef.label} — styles sync across all repeating items.`
                      : `Editing inner element: ${activePartDef.label}.`}
                  </span>
                  {tab === "content" ? (
                    <button
                      type="button"
                      className="ed-mini-link"
                      onClick={() => setTab("style")}
                    >
                      Style controls
                    </button>
                  ) : null}
                </div>
              ) : null}

              {viewport !== "desktop" ? (
                <div className="ed-viewport-hint">
                  <span>
                    Editing <strong>{viewport}</strong> responsive styles
                  </span>
                  {hasViewportOverride ? (
                    <button
                      type="button"
                      onClick={() =>
                        resetNodeStyleKeys(
                          primary.id,
                          Array.from(overriddenKeys),
                          viewport
                        )
                      }
                    >
                      <RotateCcw size={11} /> Clear overrides
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="ed-inspector-tabs" role="tablist">
                {(
                  [
                    ["content", "Content"],
                    ["layout", "Layout"],
                    ["style", "Style"],
                    ["advanced", "Advanced"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    className={cn("ed-inspector-tab", tab === key && "active")}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="ed-inspector-scroll">
                {primary.locked ? (
                  <div className="ed-locked-notice">
                    <Lock size={13} />
                    <span>Element is locked. Unlock it above to edit.</span>
                  </div>
                ) : null}

                {tab === "content" ? (
                  <div className="ed-inspector-section">
                    <ControlField label="Element Name">
                      <input
                        type="text"
                        value={primary.label}
                        disabled={primary.locked}
                        onChange={(e) =>
                          executeOperation(
                            {
                              type: "update_meta",
                              nodeId: primary.id,
                              label: e.target.value,
                            },
                            { summary: `Rename ${primary.label}` }
                          )
                        }
                      />
                    </ControlField>

                    {def?.inspectorFields.length ? (
                      def.inspectorFields.map((field) => {
                        const rawVal = primary.props?.[field.key];
                        const strVal =
                          typeof rawVal === "string"
                            ? rawVal
                            : rawVal !== undefined && rawVal !== null
                              ? String(rawVal)
                              : "";

                        if (field.type === "textarea") {
                          return (
                            <ControlField key={field.key} label={field.label}>
                              <textarea
                                rows={3}
                                disabled={primary.locked}
                                value={strVal}
                                placeholder={field.placeholder}
                                onChange={(e) =>
                                  updateNodeProps(primary.id, {
                                    [field.key]: e.target.value,
                                  })
                                }
                              />
                            </ControlField>
                          );
                        }

                        if (field.type === "html") {
                          return (
                            <ControlField key={field.key} label={field.label}>
                              <textarea
                                rows={5}
                                disabled={primary.locked}
                                value={strVal}
                                onChange={(e) =>
                                  updateNodeProps(primary.id, {
                                    [field.key]: sanitizeHtmlSubset(e.target.value),
                                  })
                                }
                              />
                              {field.help ? (
                                <small className="ed-hint">{field.help}</small>
                              ) : null}
                            </ControlField>
                          );
                        }

                        if (field.type === "select" && field.options) {
                          return (
                            <SelectControl
                              key={field.key}
                              label={field.label}
                              value={strVal || field.options[0]?.value || ""}
                              options={field.options}
                              onChange={(v) =>
                                updateNodeProps(primary.id, { [field.key]: v })
                              }
                            />
                          );
                        }

                        if (field.type === "icon") {
                          return (
                            <SelectControl
                              key={field.key}
                              label={field.label}
                              value={strVal || "arrow-right"}
                              options={ICON_OPTIONS}
                              onChange={(v) =>
                                updateNodeProps(primary.id, { [field.key]: v })
                              }
                            />
                          );
                        }

                        if (field.type === "product_select") {
                          return (
                            <SelectControl
                              key={field.key}
                              label={field.label}
                              value={strVal}
                              options={productOptions}
                              onChange={(v) =>
                                updateNodeProps(primary.id, { [field.key]: v })
                              }
                            />
                          );
                        }

                        if (field.type === "category_select") {
                          return (
                            <SelectControl
                              key={field.key}
                              label={field.label}
                              value={strVal}
                              options={categoryOptions}
                              onChange={(v) =>
                                updateNodeProps(primary.id, { [field.key]: v })
                              }
                            />
                          );
                        }

                        if (field.type === "toggle") {
                          const checked = Boolean(rawVal);
                          return (
                            <label key={field.key} className="ed-toggle-row">
                              <span>{field.label}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={primary.locked}
                                onChange={(e) =>
                                  updateNodeProps(primary.id, {
                                    [field.key]: e.target.checked,
                                  })
                                }
                              />
                            </label>
                          );
                        }

                        if (field.type === "number") {
                          const num = Number(rawVal ?? field.min ?? 1);
                          return (
                            <ControlField key={field.key} label={field.label}>
                              <input
                                type="number"
                                min={field.min}
                                max={field.max}
                                step={field.step || 1}
                                disabled={primary.locked}
                                value={Number.isFinite(num) ? num : 1}
                                onChange={(e) =>
                                  updateNodeProps(primary.id, {
                                    [field.key]: Number(e.target.value),
                                  })
                                }
                              />
                            </ControlField>
                          );
                        }

                        if (field.type === "items") {
                          const arr = Array.isArray(rawVal)
                            ? (rawVal as ElementItemData[])
                            : [];
                          return (
                            <ControlField key={field.key} label={field.label}>
                              <ItemsRepeaterControl
                                items={arr}
                                includeImage={
                                  primary.type === "image_gallery" ||
                                  primary.type === "carousel"
                                }
                                onChange={(next) =>
                                  updateNodeProps(primary.id, { [field.key]: next })
                                }
                              />
                            </ControlField>
                          );
                        }

                        if (field.type === "form_fields") {
                          const fields = Array.isArray(rawVal)
                            ? (rawVal as FormFieldData[])
                            : [];
                          return (
                            <ControlField key={field.key} label={field.label}>
                              <div className="ed-repeater">
                                {fields.map((f, idx) => (
                                  <div key={f.id} className="ed-repeater-card">
                                    <div className="ed-repeater-head">
                                      <strong>Field {idx + 1}</strong>
                                      <IconButton
                                        label="Remove field"
                                        onClick={() =>
                                          updateNodeProps(primary.id, {
                                            fields: fields.filter(
                                              (_, i) => i !== idx
                                            ),
                                          })
                                        }
                                      >
                                        <Trash2 size={11} />
                                      </IconButton>
                                    </div>
                                    <input
                                      type="text"
                                      value={f.label}
                                      onChange={(e) =>
                                        updateNodeProps(primary.id, {
                                          fields: fields.map((row, i) =>
                                            i === idx
                                              ? { ...row, label: e.target.value }
                                              : row
                                          ),
                                        })
                                      }
                                    />
                                  </div>
                                ))}
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateNodeProps(primary.id, {
                                      fields: [
                                        ...fields,
                                        {
                                          id: createElementId("field"),
                                          label: "Note",
                                          type: "textarea",
                                          placeholder: "Tell us more...",
                                        },
                                      ],
                                    })
                                  }
                                >
                                  <Plus size={12} /> Add Field
                                </Button>
                              </div>
                            </ControlField>
                          );
                        }

                        if (field.type === "media") {
                          return (
                            <ControlField key={field.key} label={field.label}>
                              <div className="ed-media-prop-row">
                                <input
                                  type="text"
                                  disabled={primary.locked}
                                  value={strVal}
                                  placeholder="/media/terrain-fallback.jpg"
                                  onChange={(e) =>
                                    updateNodeProps(primary.id, {
                                      [field.key]: e.target.value,
                                    })
                                  }
                                />
                                <Button
                                  size="sm"
                                  disabled={primary.locked}
                                  onClick={() =>
                                    setMediaTarget({
                                      kind: "prop",
                                      nodeId: primary.id,
                                      propKey: field.key,
                                      currentUrl: strVal,
                                    })
                                  }
                                >
                                  <FolderOpen size={12} />
                                  <span>Library</span>
                                </Button>
                              </div>
                            </ControlField>
                          );
                        }

                        return (
                          <ControlField key={field.key} label={field.label}>
                            <input
                              type="text"
                              disabled={primary.locked}
                              value={strVal}
                              placeholder={field.placeholder}
                              onChange={(e) =>
                                updateNodeProps(primary.id, {
                                  [field.key]: e.target.value,
                                })
                              }
                            />
                          </ControlField>
                        );
                      })
                    ) : (
                      <p className="muted" style={{ fontSize: 12.5 }}>
                        {canAcceptChild(primary)
                          ? "Container element — drop elements inside on the canvas or configure Flexbox / Grid in the Layout tab."
                          : "Use Layout and Style tabs to customize sizing and spacing."}
                      </p>
                    )}
                  </div>
                ) : null}

                {tab === "layout" ? (
                  <div className="ed-inspector-section">
                    <div className="ed-control-stack">
                      <SelectControl
                        label="Display Mode"
                        value={editStyles.display || "block"}
                        options={[
                          { value: "block", label: "Block" },
                          { value: "flex", label: "Flexbox" },
                          { value: "inline-flex", label: "Inline Flex" },
                          { value: "grid", label: "CSS Grid" },
                          { value: "inline-block", label: "Inline Block" },
                        ]}
                        overridden={overriddenKeys.has("display")}
                        viewport={viewport}
                        onReset={() => resetKey("display")}
                        onChange={(v) => setStyle("display", v)}
                      />

                      {(editStyles.display === "flex" ||
                        editStyles.display === "inline-flex") && (
                        <>
                          <div className="ed-control-grid-2">
                            <SelectControl
                              label="Direction"
                              value={editStyles.flexDirection || "row"}
                              options={[
                                { value: "row", label: "Row" },
                                { value: "column", label: "Column" },
                                { value: "row-reverse", label: "Row Reverse" },
                                { value: "column-reverse", label: "Col Reverse" },
                              ]}
                              overridden={overriddenKeys.has("flexDirection")}
                              viewport={viewport}
                              onReset={() => resetKey("flexDirection")}
                              onChange={(v) => setStyle("flexDirection", v)}
                            />
                            <SelectControl
                              label="Wrap"
                              value={editStyles.flexWrap || "nowrap"}
                              options={[
                                { value: "nowrap", label: "No Wrap" },
                                { value: "wrap", label: "Wrap" },
                              ]}
                              overridden={overriddenKeys.has("flexWrap")}
                              viewport={viewport}
                              onReset={() => resetKey("flexWrap")}
                              onChange={(v) => setStyle("flexWrap", v)}
                            />
                          </div>
                          <div className="ed-control-grid-2">
                            <SelectControl
                              label="Justify"
                              value={editStyles.justifyContent || "flex-start"}
                              options={[
                                { value: "flex-start", label: "Start" },
                                { value: "center", label: "Center" },
                                { value: "flex-end", label: "End" },
                                { value: "space-between", label: "Space Between" },
                                { value: "space-around", label: "Space Around" },
                              ]}
                              overridden={overriddenKeys.has("justifyContent")}
                              viewport={viewport}
                              onReset={() => resetKey("justifyContent")}
                              onChange={(v) => setStyle("justifyContent", v)}
                            />
                            <SelectControl
                              label="Align Items"
                              value={editStyles.alignItems || "stretch"}
                              options={[
                                { value: "stretch", label: "Stretch" },
                                { value: "flex-start", label: "Start" },
                                { value: "center", label: "Center" },
                                { value: "flex-end", label: "End" },
                              ]}
                              overridden={overriddenKeys.has("alignItems")}
                              viewport={viewport}
                              onReset={() => resetKey("alignItems")}
                              onChange={(v) => setStyle("alignItems", v)}
                            />
                          </div>
                        </>
                      )}

                      {editStyles.display === "grid" && (
                        <div className="ed-control-grid-2">
                          <ControlField
                            label="Grid Columns"
                            overridden={overriddenKeys.has("gridTemplateColumns")}
                            viewport={viewport}
                            onReset={() => resetKey("gridTemplateColumns")}
                          >
                            <input
                              type="text"
                              value={editStyles.gridTemplateColumns || ""}
                              placeholder="1fr 1fr"
                              onChange={(e) =>
                                setStyle("gridTemplateColumns", e.target.value)
                              }
                            />
                          </ControlField>
                          <UnitControl
                            label="Gap"
                            value={editStyles.gap || ""}
                            placeholder="16px"
                            overridden={overriddenKeys.has("gap")}
                            viewport={viewport}
                            onReset={() => resetKey("gap")}
                            onChange={(v) => setStyle("gap", v)}
                          />
                        </div>
                      )}

                      {editStyles.display !== "grid" && (
                        <div className="ed-control-grid-2">
                          <UnitControl
                            label="Row Gap"
                            value={editStyles.rowGap || editStyles.gap || ""}
                            placeholder="16px"
                            overridden={overriddenKeys.has("rowGap")}
                            viewport={viewport}
                            onReset={() => resetKey("rowGap")}
                            onChange={(v) => setStyle("rowGap", v)}
                          />
                          <UnitControl
                            label="Column Gap"
                            value={editStyles.columnGap || editStyles.gap || ""}
                            placeholder="16px"
                            overridden={overriddenKeys.has("columnGap")}
                            viewport={viewport}
                            onReset={() => resetKey("columnGap")}
                            onChange={(v) => setStyle("columnGap", v)}
                          />
                        </div>
                      )}

                      <PropertyPopoverRow
                        label="Dimensions"
                        summary={[
                          editStyles.width || "auto",
                          editStyles.height || "auto",
                        ].join(" × ")}
                        popoverWidth="w-[296px]"
                        disabled={primary.locked}
                        overridden={
                          overriddenKeys.has("width") ||
                          overriddenKeys.has("maxWidth") ||
                          overriddenKeys.has("height") ||
                          overriddenKeys.has("minHeight")
                        }
                        viewport={viewport}
                        onReset={() => {
                          resetKey("width");
                          resetKey("maxWidth");
                          resetKey("height");
                          resetKey("minHeight");
                        }}
                      >
                        <div className="ed-popover-stack">
                          <div className="ed-control-grid-2">
                            <UnitControl
                              label="Width"
                              value={editStyles.width || ""}
                              placeholder="auto"
                              overridden={overriddenKeys.has("width")}
                              viewport={viewport}
                              onReset={() => resetKey("width")}
                              onChange={(v) => setStyle("width", v)}
                            />
                            <UnitControl
                              label="Max Width"
                              value={editStyles.maxWidth || ""}
                              placeholder="none"
                              overridden={overriddenKeys.has("maxWidth")}
                              viewport={viewport}
                              onReset={() => resetKey("maxWidth")}
                              onChange={(v) => setStyle("maxWidth", v)}
                            />
                          </div>
                          <div className="ed-control-grid-2">
                            <UnitControl
                              label="Height"
                              value={editStyles.height || ""}
                              placeholder="auto"
                              overridden={overriddenKeys.has("height")}
                              viewport={viewport}
                              onReset={() => resetKey("height")}
                              onChange={(v) => setStyle("height", v)}
                            />
                            <UnitControl
                              label="Min Height"
                              value={editStyles.minHeight || ""}
                              placeholder="0px"
                              overridden={overriddenKeys.has("minHeight")}
                              viewport={viewport}
                              onReset={() => resetKey("minHeight")}
                              onChange={(v) => setStyle("minHeight", v)}
                            />
                          </div>
                        </div>
                      </PropertyPopoverRow>

                      <PropertyPopoverRow
                        label="Spacing"
                        summary={(() => {
                          const pParts = [
                            editStyles.paddingTop || editStyles.padding || "",
                            editStyles.paddingRight || editStyles.padding || "",
                            editStyles.paddingBottom || editStyles.padding || "",
                            editStyles.paddingLeft || editStyles.padding || "",
                          ].some(Boolean)
                            ? `P ${editStyles.paddingTop || editStyles.padding || "0"}/${editStyles.paddingLeft || editStyles.padding || "0"}`
                            : "";
                          const mParts = [
                            editStyles.marginTop || editStyles.margin || "",
                            editStyles.marginRight || editStyles.margin || "",
                            editStyles.marginBottom || editStyles.margin || "",
                            editStyles.marginLeft || editStyles.margin || "",
                          ].some(Boolean)
                            ? `M ${editStyles.marginTop || editStyles.margin || "0"}/${editStyles.marginBottom || editStyles.margin || "0"}`
                            : "";
                          return [pParts, mParts].filter(Boolean).join(" · ") || "Default";
                        })()}
                        popoverTitle="Padding & Margin"
                        popoverWidth="w-[310px]"
                        disabled={primary.locked}
                        overridden={
                          overriddenKeys.has("padding") ||
                          overriddenKeys.has("paddingTop") ||
                          overriddenKeys.has("paddingRight") ||
                          overriddenKeys.has("paddingBottom") ||
                          overriddenKeys.has("paddingLeft") ||
                          overriddenKeys.has("margin") ||
                          overriddenKeys.has("marginTop") ||
                          overriddenKeys.has("marginRight") ||
                          overriddenKeys.has("marginBottom") ||
                          overriddenKeys.has("marginLeft")
                        }
                        viewport={viewport}
                      >
                        <div className="ed-popover-stack">
                          <SpacingBoxControl
                            title="Padding"
                            values={{
                              top: editStyles.paddingTop || editStyles.padding || "",
                              right: editStyles.paddingRight || editStyles.padding || "",
                              bottom: editStyles.paddingBottom || editStyles.padding || "",
                              left: editStyles.paddingLeft || editStyles.padding || "",
                            }}
                            keys={{
                              top: "paddingTop",
                              right: "paddingRight",
                              bottom: "paddingBottom",
                              left: "paddingLeft",
                            }}
                            overriddenKeys={overriddenKeys}
                            viewport={viewport}
                            onChangeKey={(side, next) => {
                              const map = {
                                top: "paddingTop",
                                right: "paddingRight",
                                bottom: "paddingBottom",
                                left: "paddingLeft",
                              } as const;
                              setStyle(map[side], next);
                            }}
                            onResetAll={
                              viewport !== "desktop"
                                ? () =>
                                    resetNodeStyleKeys(
                                      primary.id,
                                      [
                                        "padding",
                                        "paddingTop",
                                        "paddingRight",
                                        "paddingBottom",
                                        "paddingLeft",
                                      ],
                                      viewport
                                    )
                                : undefined
                            }
                          />
                          <SpacingBoxControl
                            title="Margin"
                            values={{
                              top: editStyles.marginTop || editStyles.margin || "",
                              right: editStyles.marginRight || editStyles.margin || "",
                              bottom: editStyles.marginBottom || editStyles.margin || "",
                              left: editStyles.marginLeft || editStyles.margin || "",
                            }}
                            keys={{
                              top: "marginTop",
                              right: "marginRight",
                              bottom: "marginBottom",
                              left: "marginLeft",
                            }}
                            overriddenKeys={overriddenKeys}
                            viewport={viewport}
                            onChangeKey={(side, next) => {
                              const map = {
                                top: "marginTop",
                                right: "marginRight",
                                bottom: "marginBottom",
                                left: "marginLeft",
                              } as const;
                              setStyle(map[side], next);
                            }}
                            onResetAll={
                              viewport !== "desktop"
                                ? () =>
                                    resetNodeStyleKeys(
                                      primary.id,
                                      [
                                        "margin",
                                        "marginTop",
                                        "marginRight",
                                        "marginBottom",
                                        "marginLeft",
                                      ],
                                      viewport
                                    )
                                : undefined
                            }
                          />
                        </div>
                      </PropertyPopoverRow>

                      <PropertyPopoverRow
                        label="Position & Overflow"
                        summary={[
                          editStyles.position || "relative",
                          editStyles.overflow || "visible",
                          editStyles.zIndex ? `z ${editStyles.zIndex}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        popoverWidth="w-[296px]"
                        disabled={primary.locked}
                      >
                        <div className="ed-popover-stack">
                          <div className="ed-control-grid-2">
                            <SelectControl
                              label="Position"
                              value={editStyles.position || "relative"}
                              options={[
                                { value: "relative", label: "Relative (Flow)" },
                                { value: "static", label: "Static" },
                                { value: "sticky", label: "Sticky" },
                                { value: "absolute", label: "Absolute Overlay" },
                              ]}
                              onChange={(v) => setStyle("position", v)}
                            />
                            <SelectControl
                              label="Overflow"
                              value={editStyles.overflow || "visible"}
                              options={[
                                { value: "visible", label: "Visible" },
                                { value: "hidden", label: "Hidden" },
                                { value: "auto", label: "Auto Scroll" },
                              ]}
                              onChange={(v) => setStyle("overflow", v)}
                            />
                          </div>
                          <div className="ed-control-grid-2">
                            <ControlField label="Z-Index">
                              <input
                                type="number"
                                value={editStyles.zIndex || ""}
                                placeholder="auto"
                                onChange={(e) => setStyle("zIndex", e.target.value)}
                              />
                            </ControlField>
                            <ControlField label="Aspect Ratio">
                              <input
                                type="text"
                                value={editStyles.aspectRatio || ""}
                                placeholder="16 / 9"
                                onChange={(e) =>
                                  setStyle("aspectRatio", e.target.value)
                                }
                              />
                            </ControlField>
                          </div>
                        </div>
                      </PropertyPopoverRow>
                    </div>
                  </div>
                ) : null}

                {tab === "style" ? (
                  <div className="ed-inspector-section">
                    <label className="ed-toggle-row" style={{ marginBottom: 8 }}>
                      <span>Edit Hover State</span>
                      <input
                        type="checkbox"
                        checked={editHoverState}
                        onChange={(e) => setEditHoverState(e.target.checked)}
                      />
                    </label>

                    <div className="ed-control-stack">
                      <ColorControl
                        label="Text Color"
                        value={editStyles.color || ""}
                        placeholder="#111318"
                        palette={brandPalette}
                        onAddPaletteColor={canWrite ? handleFallbackAddPalette : undefined}
                        overridden={overriddenKeys.has("color")}
                        viewport={viewport}
                        onReset={() => resetKey("color")}
                        onChange={(v) => setStyle("color", v)}
                      />
                      <ColorControl
                        label="Background Color"
                        value={editStyles.backgroundColor || ""}
                        placeholder="transparent"
                        palette={brandPalette}
                        onAddPaletteColor={canWrite ? handleFallbackAddPalette : undefined}
                        overridden={overriddenKeys.has("backgroundColor")}
                        viewport={viewport}
                        onReset={() => resetKey("backgroundColor")}
                        onChange={(v) => setStyle("backgroundColor", v)}
                      />
                      <BackgroundImageControl
                        backgroundImage={editStyles.backgroundImage}
                        backgroundColor={editStyles.backgroundColor}
                        backgroundPosition={editStyles.backgroundPosition}
                        backgroundSize={editStyles.backgroundSize}
                        backgroundRepeat={editStyles.backgroundRepeat}
                        backgroundAttachment={editStyles.backgroundAttachment}
                        palette={brandPalette}
                        gradientPresets={GRADIENT_PRESETS}
                        onSelectGradient={(v) => setStyle("backgroundImage", v)}
                        onAddPaletteColor={canWrite ? handleFallbackAddPalette : undefined}
                        canUploadMedia={canUploadMedia}
                        uploading={quickUploadMutation.isPending}
                        disabled={primary.locked}
                        onChangeStyles={setStyleBatch}
                        onOpenLibrary={() =>
                          setMediaTarget({
                            kind: "background",
                            nodeId: primary.id,
                            nodeLabel: primary.label,
                            partKey: activePartKey,
                            partLabel: activePartDef?.label ?? null,
                            breakpoint: activeBreakpoint,
                            currentBg: editStyles.backgroundImage || "",
                            backgroundColor: editStyles.backgroundColor,
                            hasSize: Boolean(editStyles.backgroundSize),
                            hasPosition: Boolean(editStyles.backgroundPosition),
                            hasRepeat: Boolean(editStyles.backgroundRepeat),
                          })
                        }
                        onQuickUpload={(file) => {
                          if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes((file.type || "").toLowerCase())) {
                            onNotify?.("Only JPEG, PNG, WebP, and GIF images are allowed");
                            return;
                          }
                          if (file.size > 5_000_000) {
                            onNotify?.("Choose an image under 5 MB");
                            return;
                          }
                          quickUploadMutation.mutate({
                            file,
                            target: {
                              kind: "background",
                              nodeId: primary.id,
                              nodeLabel: primary.label,
                              partKey: activePartKey,
                              partLabel: activePartDef?.label ?? null,
                              breakpoint: activeBreakpoint,
                              currentBg: editStyles.backgroundImage || "",
                              backgroundColor: editStyles.backgroundColor,
                              hasSize: Boolean(editStyles.backgroundSize),
                              hasPosition: Boolean(editStyles.backgroundPosition),
                              hasRepeat: Boolean(editStyles.backgroundRepeat),
                            },
                          });
                        }}
                      />

                      <PropertyPopoverRow
                        label="Typography"
                        summary={[
                          editStyles.fontFamily || "Inter",
                          editStyles.fontSize || "16px",
                          editStyles.fontWeight || "400",
                        ].join(" · ")}
                        popoverWidth="w-[300px]"
                        disabled={primary.locked}
                        overridden={
                          overriddenKeys.has("fontFamily") ||
                          overriddenKeys.has("fontSize") ||
                          overriddenKeys.has("fontWeight") ||
                          overriddenKeys.has("textAlign")
                        }
                        viewport={viewport}
                      >
                        <div className="ed-popover-stack">
                          <div className="ed-control-grid-2">
                            <SelectControl
                              label="Font Family"
                              value={editStyles.fontFamily || "Inter"}
                              options={FONT_OPTIONS}
                              onChange={(v) => setStyle("fontFamily", v)}
                            />
                            <UnitControl
                              label="Font Size"
                              value={editStyles.fontSize || ""}
                              placeholder="16px"
                              overridden={overriddenKeys.has("fontSize")}
                              viewport={viewport}
                              onReset={() => resetKey("fontSize")}
                              onChange={(v) => setStyle("fontSize", v)}
                            />
                          </div>
                          <div className="ed-control-grid-2">
                            <SelectControl
                              label="Font Weight"
                              value={editStyles.fontWeight || "400"}
                              options={[
                                { value: "400", label: "Regular (400)" },
                                { value: "500", label: "Medium (500)" },
                                { value: "600", label: "Semibold (600)" },
                                { value: "700", label: "Bold (700)" },
                              ]}
                              onChange={(v) => setStyle("fontWeight", v)}
                            />
                            <SelectControl
                              label="Text Align"
                              value={editStyles.textAlign || "left"}
                              options={[
                                { value: "left", label: "Left" },
                                { value: "center", label: "Center" },
                                { value: "right", label: "Right" },
                              ]}
                              overridden={overriddenKeys.has("textAlign")}
                              viewport={viewport}
                              onReset={() => resetKey("textAlign")}
                              onChange={(v) => setStyle("textAlign", v)}
                            />
                          </div>
                          <div className="ed-control-grid-2">
                            <ControlField label="Line Height">
                              <input
                                type="text"
                                value={editStyles.lineHeight || ""}
                                placeholder="1.5"
                                onChange={(e) => setStyle("lineHeight", e.target.value)}
                              />
                            </ControlField>
                            <UnitControl
                              label="Letter Spacing"
                              value={editStyles.letterSpacing || ""}
                              placeholder="0px"
                              onChange={(v) => setStyle("letterSpacing", v)}
                            />
                          </div>
                        </div>
                      </PropertyPopoverRow>

                      <PropertyPopoverRow
                        label="Border"
                        summary={
                          [
                            editStyles.borderWidth
                              ? `${editStyles.borderWidth} ${editStyles.borderStyle || "solid"}`
                              : "",
                            editStyles.borderRadius
                              ? `r ${editStyles.borderRadius}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "None"
                        }
                        preview={
                          editStyles.borderColor ? (
                            <span
                              className="ed-color-chip"
                              style={{ backgroundColor: editStyles.borderColor }}
                              aria-hidden="true"
                            />
                          ) : undefined
                        }
                        popoverWidth="w-[296px]"
                        disabled={primary.locked}
                        overridden={overriddenKeys.has("borderRadius")}
                        viewport={viewport}
                        onClear={
                          editStyles.borderWidth ||
                          editStyles.borderRadius ||
                          editStyles.borderColor
                            ? () =>
                                setStyleBatch({
                                  borderWidth: "",
                                  borderStyle: "",
                                  borderRadius: "",
                                  borderColor: "",
                                })
                            : undefined
                        }
                        clearLabel="Clear Border"
                      >
                        <div className="ed-popover-stack">
                          <div className="ed-control-grid-2">
                            <UnitControl
                              label="Border Width"
                              value={editStyles.borderWidth || ""}
                              placeholder="0px"
                              onChange={(v) => {
                                setStyle("borderWidth", v);
                                if (v && !editStyles.borderStyle) {
                                  setStyle("borderStyle", "solid");
                                }
                              }}
                            />
                            <UnitControl
                              label="Border Radius"
                              value={editStyles.borderRadius || ""}
                              placeholder="0px"
                              overridden={overriddenKeys.has("borderRadius")}
                              viewport={viewport}
                              onReset={() => resetKey("borderRadius")}
                              onChange={(v) => setStyle("borderRadius", v)}
                            />
                          </div>
                          <SelectControl
                            label="Border Style"
                            value={editStyles.borderStyle || "solid"}
                            options={[
                              { value: "solid", label: "Solid" },
                              { value: "dashed", label: "Dashed" },
                              { value: "dotted", label: "Dotted" },
                              { value: "none", label: "None" },
                            ]}
                            onChange={(v) => setStyle("borderStyle", v)}
                          />
                          <ColorControl
                            label="Border Color"
                            displayMode="inline"
                            value={editStyles.borderColor || ""}
                            placeholder="#E5E7EB"
                            palette={brandPalette}
                            onAddPaletteColor={canWrite ? handleFallbackAddPalette : undefined}
                            onChange={(v) => setStyle("borderColor", v)}
                          />
                        </div>
                      </PropertyPopoverRow>

                      <PropertyPopoverRow
                        label="Effects"
                        summary={[
                          SHADOW_PRESETS.find(
                            (p) => p.value === (editStyles.boxShadow || "none")
                          )?.label || "Custom",
                          `${Math.round(opacityNum * 100)}%`,
                        ].join(" · ")}
                        popoverWidth="w-[288px]"
                        disabled={primary.locked}
                      >
                        <div className="ed-popover-stack">
                          <SelectControl
                            label="Box Shadow"
                            value={
                              SHADOW_PRESETS.some(
                                (p) => p.value === (editStyles.boxShadow || "none")
                              )
                                ? editStyles.boxShadow || "none"
                                : "none"
                            }
                            options={SHADOW_PRESETS}
                            onChange={(v) => setStyle("boxShadow", v)}
                          />
                          <SliderControl
                            label="Opacity"
                            value={opacityNum}
                            min={0.1}
                            max={1}
                            step={0.05}
                            onChange={(v) => setStyle("opacity", v)}
                          />
                        </div>
                      </PropertyPopoverRow>
                    </div>
                  </div>
                ) : null}

                {tab === "advanced" ? (
                  <div className="ed-inspector-section">
                    <div className="ed-control-stack">
                      <label className="ed-toggle-row">
                        <span>Element Visible</span>
                        <input
                          type="checkbox"
                          checked={primary.visible}
                          onChange={() => toggleNodeVisibility(primary.id)}
                        />
                      </label>

                      <div className="ed-control-grid-3">
                        {(["desktop", "tablet", "mobile"] as const).map((bp) => {
                          const vis = primary.visibility?.[bp] ?? true;
                          return (
                            <label key={bp} className="ed-vis-check">
                              <input
                                type="checkbox"
                                checked={vis}
                                onChange={(e) =>
                                  executeOperation(
                                    {
                                      type: "update_visibility",
                                      nodeId: primary.id,
                                      visibility: { [bp]: e.target.checked },
                                    },
                                    { summary: `Toggle ${bp} visibility` }
                                  )
                                }
                              />
                              <span>{bp}</span>
                            </label>
                          );
                        })}
                      </div>

                      <ControlField label="Restricted CSS Classes">
                        <div className="ed-tag-list">
                          {(primary.customCssClasses || []).map((cls) => (
                            <Badge key={cls} tone="neutral">
                              <span>.{cls}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${cls}`}
                                onClick={() =>
                                  executeOperation({
                                    type: "update_advanced",
                                    nodeId: primary.id,
                                    customCssClasses: (
                                      primary.customCssClasses || []
                                    ).filter((c) => c !== cls),
                                  })
                                }
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="ed-inline-add">
                          <input
                            type="text"
                            placeholder="hero-tight"
                            value={newClassInput}
                            onChange={(e) => setNewClassInput(e.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const cleaned = newClassInput.trim();
                              if (!isValidCssClass(cleaned)) return;
                              executeOperation({
                                type: "update_advanced",
                                nodeId: primary.id,
                                customCssClasses: [
                                  ...(primary.customCssClasses || []),
                                  cleaned,
                                ],
                              });
                              setNewClassInput("");
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </ControlField>

                      <ControlField label="Restricted HTML / ARIA Attributes">
                        <div className="ed-attr-list">
                          {Object.entries(primary.htmlAttributes || {}).map(
                            ([k, v]) => (
                              <div key={k} className="ed-attr-row">
                                <code>
                                  {k}=&quot;{v}&quot;
                                </code>
                                <button
                                  type="button"
                                  aria-label={`Remove attribute ${k}`}
                                  onClick={() => {
                                    const next = {
                                      ...(primary.htmlAttributes || {}),
                                    };
                                    delete next[k];
                                    executeOperation({
                                      type: "update_advanced",
                                      nodeId: primary.id,
                                      htmlAttributes: next,
                                    });
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            )
                          )}
                        </div>
                        <div className="ed-control-grid-2">
                          <input
                            type="text"
                            placeholder="aria-label"
                            value={newAttrKey}
                            onChange={(e) => setNewAttrKey(e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Section label"
                            value={newAttrVal}
                            onChange={(e) => setNewAttrVal(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!newAttrKey.trim()) return;
                            executeOperation({
                              type: "update_advanced",
                              nodeId: primary.id,
                              htmlAttributes: {
                                ...(primary.htmlAttributes || {}),
                                [newAttrKey.trim()]: newAttrVal.trim(),
                              },
                            });
                            setNewAttrKey("");
                            setNewAttrVal("");
                          }}
                        >
                          <Plus size={12} /> Set Attribute
                        </Button>
                      </ControlField>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          );
        })()
      ) : null}

      <MediaPickerModal
        open={Boolean(mediaTarget)}
        currentUrl={
          mediaTarget
            ? mediaTarget.kind === "prop"
              ? mediaTarget.currentUrl
              : parseBackgroundImage(mediaTarget.currentBg).imageUrl
            : ""
        }
        canUploadMedia={canUploadMedia}
        onOpenChange={(open) => {
          if (!open) setMediaTarget(null);
        }}
        onSelect={(url) => {
          if (!mediaTarget) return;
          applySelectedMediaUrl(mediaTarget, url);
        }}
        onNotify={onNotify}
      />
    </aside>
  );
}
