"use client";

import {
  ArrowDown,
  ArrowUp,
  BoxSelect,
  Copy,
  Eye,
  EyeOff,
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
  canAcceptChild,
  createElementId,
  findNode,
} from "@/features/builder/operations";
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
import { cn } from "@/lib/format";
import type { CategoryDto, ProductDto } from "@/types/api-commerce";
import type { ThemeTokens } from "@/types/api-cms-ai";
import {
  ColorControl,
  ControlField,
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
}) {
  const updateColor = (key: keyof ThemeTokens["colors"], val: string) => {
    onChangeTokens({
      ...tokens,
      colors: {
        ...tokens.colors,
        [key]: val,
      },
    });
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
  onDuplicateAll,
  onDeleteAll,
  onWrapInContainer,
  onApplyBatchStyles,
}: {
  selectedNodes: ElementNode[];
  viewport: ViewportMode;
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
            onChange={(v) => {
              setBatchColor(v);
              onApplyBatchStyles({ color: v });
            }}
          />
          <ColorControl
            label="Background Color"
            value={batchBg}
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

export function VisualInspector({
  products,
  categories,
  canWrite,
  canPublish,
  savingTheme,
  publishingTheme,
  onSaveTheme,
  onPublishTheme,
}: {
  products: ProductDto[];
  categories: CategoryDto[];
  canWrite: boolean;
  canPublish: boolean;
  savingTheme: boolean;
  publishingTheme: boolean;
  onSaveTheme: () => void;
  onPublishTheme: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("content");
  const [inspectGlobalTheme, setInspectGlobalTheme] = useState(false);
  const [newClassInput, setNewClassInput] = useState("");
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");
  const [editHoverState, setEditHoverState] = useState(false);

  const nodes = useEditorStore((s) => s.nodes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const viewport = useEditorStore((s) => s.viewport);
  const themeTokens = useEditorStore((s) => s.themeTokens);
  const themeDirty = useEditorStore((s) => s.themeDirty);
  const setThemeTokens = useEditorStore((s) => s.setThemeTokens);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const resetNodeStyleKeys = useEditorStore((s) => s.resetNodeStyleKeys);
  const toggleNodeVisibility = useEditorStore((s) => s.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((s) => s.toggleNodeLock);
  const executeOperation = useEditorStore((s) => s.executeOperation);
  const executeBatch = useEditorStore((s) => s.executeBatch);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);

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
        />
      ) : selectedNodes.length > 1 ? (
        <BulkMultiSelectPanel
          selectedNodes={selectedNodes}
          viewport={viewport}
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
          const { resolved, overriddenKeys, hasViewportOverride } =
            resolveStylesForViewport(primary.styles, viewport);
          const editStyles: StyleValues =
            editHoverState && tab === "style"
              ? primary.styles?.hover || {}
              : resolved;

          const setStyle = (key: StylePropertyKey, val: string) => {
            updateNodeStyles(
              primary.id,
              { [key]: val },
              activeBreakpoint,
              `Update ${key} on ${primary.label}`
            );
          };
          const resetKey = (key: StylePropertyKey) => {
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
                  <span>{def?.label || primary.type}</span>
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

                        return (
                          <ControlField key={field.key} label={field.label}>
                            <input
                              type="text"
                              disabled={primary.locked}
                              value={strVal}
                              placeholder={
                                field.type === "media"
                                  ? "/media/terrain-fallback.jpg"
                                  : field.placeholder
                              }
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
                        overridden={overriddenKeys.has("color")}
                        viewport={viewport}
                        onReset={() => resetKey("color")}
                        onChange={(v) => setStyle("color", v)}
                      />
                      <ColorControl
                        label="Background Color"
                        value={editStyles.backgroundColor || ""}
                        placeholder="transparent"
                        overridden={overriddenKeys.has("backgroundColor")}
                        viewport={viewport}
                        onReset={() => resetKey("backgroundColor")}
                        onChange={(v) => setStyle("backgroundColor", v)}
                      />
                      <SelectControl
                        label="Background Gradient"
                        value={
                          GRADIENT_PRESETS.some(
                            (g) => g.value === (editStyles.backgroundImage || "")
                          )
                            ? editStyles.backgroundImage || ""
                            : ""
                        }
                        options={GRADIENT_PRESETS}
                        onChange={(v) => setStyle("backgroundImage", v)}
                      />

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

                      <ColorControl
                        label="Border Color"
                        value={editStyles.borderColor || ""}
                        placeholder="#E5E7EB"
                        onChange={(v) => setStyle("borderColor", v)}
                      />

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
    </aside>
  );
}
