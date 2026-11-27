"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  Eye,
  EyeOff,
  Flame,
  GripVertical,
  Heart,
  Layers,
  Lightbulb,
  Lock,
  Megaphone,
  PartyPopper,
  Plus,
  Search,
  Snowflake,
  Sparkles,
  Sticker,
  Sun,
  Timer,
  Trash2,
  Unlock,
  Flower2,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  EFFECT_BY_TYPE,
  EFFECT_CATALOG,
  PALETTE_CATEGORIES,
  ZONE_LABELS,
  type EffectCatalogItem,
  type EffectPaletteCategory,
} from "../catalog";
import type { EffectLayerType, ExperienceLayer, ExperienceTemplateDto } from "../types";
import { useExperienceStudioStore } from "./experience-store";

type LeftTab = "effects" | "layers" | "presets";

const EFFECT_ICON_MAP: Record<EffectLayerType, typeof Snowflake> = {
  snowfall: Snowflake,
  blossom_petals: Flower2,
  corner_floral_frame: Flower2,
  floating_hearts: Heart,
  golden_particles: Sparkles,
  santa_sleigh: Sparkles,
  fireworks: PartyPopper,
  confetti_burst: PartyPopper,
  string_lights: Lightbulb,
  festive_lanterns: Lightbulb,
  promo_banner: Megaphone,
  countdown_bar: Timer,
  ambient_glow: Sun,
  floating_sticker: Sticker,
};

function EffectIcon({ type, size }: { type: EffectLayerType; size: number }) {
  const Icon = EFFECT_ICON_MAP[type] || Flame;
  return <Icon size={size} />;
}

function DraggableEffectCard({
  item,
  canWrite,
  onAdd,
}: {
  item: EffectCatalogItem;
  canWrite: boolean;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `exp-palette-${item.type}`,
    data: {
      kind: "effect-palette",
      effectType: item.type,
      label: item.name,
    },
    disabled: !canWrite,
  });

  return (
    <div
      ref={setNodeRef}
      className={`exp-palette-card${isDragging ? " is-dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div
        className="exp-palette-icon"
        style={{ background: `${item.accentColor}1c`, color: item.accentColor }}
      >
        <EffectIcon type={item.type} size={16} />
      </div>
      <div className="exp-palette-copy">
        <strong>{item.name}</strong>
        <small>{item.description}</small>
      </div>
      {canWrite ? (
        <button
          type="button"
          className="exp-palette-add"
          title={`Add ${item.name}`}
          aria-label={`Add ${item.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          <Plus size={13} />
        </button>
      ) : null}
    </div>
  );
}

function SortableLayerRow({
  layer,
  selected,
  canWrite,
  onSelect,
  onToggleVis,
  onToggleLock,
  onDuplicate,
  onDelete,
}: {
  layer: ExperienceLayer;
  selected: boolean;
  canWrite: boolean;
  onSelect: () => void;
  onToggleVis: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: layer.id,
      data: { kind: "layer-sort", layerId: layer.id },
      disabled: !canWrite || layer.locked,
    });

  const def = EFFECT_BY_TYPE[layer.type];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`exp-layer-row${selected ? " is-selected" : ""}${!layer.enabled ? " is-hidden" : ""}${isDragging ? " is-dragging" : ""}`}
      onClick={onSelect}
    >
      <button
        type="button"
        className="exp-layer-handle"
        aria-label={`Reorder ${layer.label}`}
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={12} />
      </button>

      <span
        className="exp-layer-badge-icon"
        style={{ color: def?.accentColor || "var(--accent)" }}
      >
        <EffectIcon type={layer.type} size={13} />
      </span>

      <div className="exp-layer-meta">
        <strong>{layer.label}</strong>
        <small>
          {ZONE_LABELS[layer.zone] || layer.zone} · z{layer.zIndex}
        </small>
      </div>

      {canWrite ? (
        <div className="exp-layer-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title={layer.enabled ? "Hide layer" : "Show layer"}
            aria-label={layer.enabled ? "Hide layer" : "Show layer"}
            onClick={onToggleVis}
          >
            {layer.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            type="button"
            title={layer.locked ? "Unlock layer" : "Lock layer"}
            aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
            onClick={onToggleLock}
          >
            {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <button
            type="button"
            title="Duplicate layer"
            aria-label="Duplicate layer"
            onClick={onDuplicate}
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            title="Delete layer"
            aria-label="Delete layer"
            onClick={onDelete}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ExperienceLeftPanel({
  templates,
  canWrite,
  onNotify,
}: {
  templates: ExperienceTemplateDto[];
  canWrite: boolean;
  onNotify: (msg: string) => void;
}) {
  const [tab, setTab] = useState<LeftTab>("effects");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<EffectPaletteCategory | "all">("all");

  const layers = useExperienceStudioStore((s) => s.config.layers);
  const selectedLayerId = useExperienceStudioStore((s) => s.selectedLayerId);
  const selectLayer = useExperienceStudioStore((s) => s.selectLayer);
  const addLayer = useExperienceStudioStore((s) => s.addLayer);
  const toggleLayerVisibility = useExperienceStudioStore((s) => s.toggleLayerVisibility);
  const toggleLayerLock = useExperienceStudioStore((s) => s.toggleLayerLock);
  const duplicateLayer = useExperienceStudioStore((s) => s.duplicateLayer);
  const removeLayer = useExperienceStudioStore((s) => s.removeLayer);
  const applyTemplateConfig = useExperienceStudioStore((s) => s.applyTemplateConfig);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EFFECT_CATALOG.filter((item) => {
      if (catFilter !== "all" && item.category !== catFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
      );
    });
  }, [search, catFilter]);

  return (
    <aside className="ed-left-sidebar exp-left-panel" aria-label="Effects & Layers">
      <div className="ed-sidebar-tabs exp-left-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "effects"}
          className={`ed-sidebar-tab exp-tab-btn${tab === "effects" ? " active" : ""}`}
          onClick={() => setTab("effects")}
        >
          <Sparkles size={13} />
          <span>Effects</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "layers"}
          className={`ed-sidebar-tab exp-tab-btn${tab === "layers" ? " active" : ""}`}
          onClick={() => setTab("layers")}
        >
          <Layers size={13} />
          <span>Layers ({layers.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "presets"}
          className={`ed-sidebar-tab exp-tab-btn${tab === "presets" ? " active" : ""}`}
          onClick={() => setTab("presets")}
        >
          <Wand2 size={13} />
          <span>Templates</span>
        </button>
      </div>

      {tab === "effects" ? (
        <div className="exp-left-scroll">
          <div className="exp-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search effects (snow, fireworks...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="exp-cat-pills">
            {PALETTE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`exp-cat-pill${catFilter === c.key ? " active" : ""}`}
                onClick={() => setCatFilter(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <p className="exp-drag-hint">
            Drag any effect onto a highlighted storefront zone, or click + to add.
          </p>

          <div className="exp-palette-list">
            {filteredCatalog.map((item) => (
              <DraggableEffectCard
                key={item.type}
                item={item}
                canWrite={canWrite}
                onAdd={() => {
                  addLayer(item.type);
                  onNotify(`Added ${item.name}`);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {tab === "layers" ? (
        <div className="exp-left-scroll">
          {layers.length === 0 ? (
            <div className="exp-empty-box">
              <strong>No effect layers yet</strong>
              <p>Switch to the Effects tab and drag or click + to add visual layers.</p>
            </div>
          ) : (
            <SortableContext
              items={layers.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="exp-layers-list">
                {layers.map((layer) => (
                  <SortableLayerRow
                    key={layer.id}
                    layer={layer}
                    selected={selectedLayerId === layer.id}
                    canWrite={canWrite}
                    onSelect={() => selectLayer(layer.id)}
                    onToggleVis={() => toggleLayerVisibility(layer.id)}
                    onToggleLock={() => toggleLayerLock(layer.id)}
                    onDuplicate={() => duplicateLayer(layer.id)}
                    onDelete={() => removeLayer(layer.id)}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      ) : null}

      {tab === "presets" ? (
        <div className="exp-left-scroll">
          <p className="exp-drag-hint">
            Apply a curated seasonal blueprint to this draft (supports Undo).
          </p>
          <div className="exp-presets-mini">
            {templates.map((tpl) => (
              <div key={tpl.presetKey} className="exp-preset-mini-card">
                <div
                  className="exp-preset-swatch"
                  style={{ background: tpl.previewGradient }}
                />
                <div className="exp-preset-mini-body">
                  <strong>{tpl.name}</strong>
                  <small>
                    {tpl.category} · {tpl.config.layers.length} layers
                  </small>
                </div>
                {canWrite ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      applyTemplateConfig(tpl.config);
                      onNotify(`Applied "${tpl.name}" recipe`);
                    }}
                  >
                    Apply
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
