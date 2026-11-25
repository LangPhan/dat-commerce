"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SYSTEM_ANIMATION_PRESETS,
  getPresetsByCategory,
} from "@/features/motion/presets";
import type {
  AnimationPresetDefinition,
  ElementMotionConfig,
  EntrancePresetKey,
  HoverPresetKey,
  MotionCategory,
} from "@/features/motion/types";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { cn } from "@/lib/format";

const LIBRARY_TABS: Array<{ id: MotionCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "entrance", label: "Entrance" },
  { id: "scroll", label: "Scroll" },
  { id: "hover", label: "Hover" },
  { id: "interaction", label: "Interaction" },
  { id: "continuous", label: "Continuous" },
  { id: "text", label: "Text" },
  { id: "custom", label: "Custom" },
];

function PresetMiniPreview({
  preset,
  replayTick,
}: {
  preset: AnimationPresetDefinition;
  replayTick: number;
}) {
  const ent = preset.config.entrance?.preset;
  const cont = preset.config.continuous?.preset;
  const hov = preset.config.hover?.preset;
  const txt = preset.config.text?.preset;
  const sc = preset.config.scroll?.effect;

  const animStyle: CSSProperties = {};
  let cls = "ed-motion-preview-chip";

  if (ent && ent !== "none") {
    cls = cn(cls, "m-entrance-active");
    Object.assign(animStyle, {
      "--m-ent-name": `m-${ent}`,
      "--m-ent-dur": `${Math.min(preset.defaultDuration, 900)}ms`,
      "--m-ent-delay": "0ms",
    });
  } else if (cont && cont !== "none") {
    cls = cn(cls, "m-has-continuous");
    Object.assign(animStyle, {
      "--m-cont-name": `m-cont-${cont}`,
      "--m-cont-dur": `${Math.min(preset.defaultDuration, 2200)}ms`,
    });
  } else if (txt && txt !== "none") {
    if (txt === "gradientTextMove") {
      cls = cn(cls, "m-text-gradient");
    } else {
      cls = cn(cls, "m-entrance-active");
      Object.assign(animStyle, {
        "--m-ent-name": txt === "textBlurReveal" ? "m-textBlurReveal" : "m-fadeInUp",
        "--m-ent-dur": "600ms",
      });
    }
  } else if (hov && hov !== "none") {
    cls = cn(cls, "m-has-hover");
    Object.assign(animStyle, {
      "--m-hov-scale": String(preset.config.hover?.scale ?? (hov === "scaleUp" ? 1.08 : hov === "scaleDown" ? 0.94 : 1)),
      "--m-hov-ty": `${preset.config.hover?.translateY ?? (hov === "moveUp" ? -5 : hov === "moveDown" ? 5 : 0)}px`,
      "--m-hov-tx": `${preset.config.hover?.translateX ?? (hov === "moveLeft" ? -5 : hov === "moveRight" ? 5 : 0)}px`,
      "--m-hov-rot": `${preset.config.hover?.rotate ?? (hov === "rotate" ? 4 : 0)}deg`,
      "--m-hov-dur": "220ms",
    });
  } else if (sc && sc !== "none") {
    cls = cn(cls, "m-entrance-active");
    Object.assign(animStyle, {
      "--m-ent-name": "m-fadeInUp",
      "--m-ent-dur": "650ms",
    });
  }

  return (
    <div className="ed-motion-preview-stage">
      <div key={replayTick} className={cls} style={animStyle}>
        {preset.category === "text" ? "Aa" : "Box"}
      </div>
    </div>
  );
}

export function AnimationLibraryModal({
  open,
  onOpenChange,
  customPresets,
  canWrite,
  onApplyPreset,
  onNotify,
  initialCategory = "all",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customPresets: AnimationPresetDefinition[];
  canWrite: boolean;
  onApplyPreset: (preset: AnimationPresetDefinition) => void;
  onNotify?: (msg: string) => void;
  initialCategory?: MotionCategory | "all";
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MotionCategory | "all">(initialCategory);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [localFavorites, setLocalFavorites] = useState<Record<string, boolean>>({});
  const [replayTicks, setReplayTicks] = useState<Record<string, number>>({});

  // Custom preset form state
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AnimationPresetDefinition | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<MotionCategory>("entrance");
  const [formDesc, setFormDesc] = useState("");
  const [formEntrancePreset, setFormEntrancePreset] = useState<EntrancePresetKey>("fadeInUp");
  const [formHoverPreset, setFormHoverPreset] = useState<HoverPresetKey>("none");
  const [formDuration, setFormDuration] = useState(550);
  const [formEasing, setFormEasing] = useState("easeOut");
  const [formError, setFormError] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      category: MotionCategory;
      description: string;
      config: ElementMotionConfig;
      favorite?: boolean;
    }) => cmsAdminApi.createAnimationPreset(payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["cms-animation-presets"] });
      void queryClient.invalidateQueries({ queryKey: ["store-animation-presets"] });
      setComposerOpen(false);
      setEditingPreset(null);
      setTab("custom");
      onNotify?.(`Saved preset "${created.name}"`);
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed to save preset"),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name?: string;
      category?: MotionCategory;
      description?: string;
      config?: ElementMotionConfig;
      favorite?: boolean;
      expectedVersion?: number;
    }) =>
      cmsAdminApi.updateAnimationPreset(payload.id, {
        name: payload.name,
        category: payload.category,
        description: payload.description,
        config: payload.config,
        favorite: payload.favorite,
        expectedVersion: payload.expectedVersion,
      }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["cms-animation-presets"] });
      void queryClient.invalidateQueries({ queryKey: ["store-animation-presets"] });
      setComposerOpen(false);
      setEditingPreset(null);
      onNotify?.(`Updated preset "${updated.name}"`);
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : "Failed to update preset"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsAdminApi.deleteAnimationPreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cms-animation-presets"] });
      void queryClient.invalidateQueries({ queryKey: ["store-animation-presets"] });
      onNotify?.("Deleted custom animation preset");
    },
    onError: (err) => onNotify?.(err instanceof Error ? err.message : "Failed to delete preset"),
  });

  const isPresetFavorite = (p: AnimationPresetDefinition) =>
    localFavorites[p.id] !== undefined ? localFavorites[p.id] : Boolean(p.isFavorite);

  const filteredPresets = useMemo(() => {
    const base =
      tab === "custom"
        ? customPresets
        : getPresetsByCategory(tab, customPresets);
    const q = query.trim().toLowerCase();
    return base.filter((p) => {
      if (favoritesOnly && !isPresetFavorite(p)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.group || "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, customPresets, query, favoritesOnly, localFavorites]);

  const openCreateForm = () => {
    setEditingPreset(null);
    setFormName("");
    setFormCategory("entrance");
    setFormDesc("");
    setFormEntrancePreset("fadeInUp");
    setFormHoverPreset("none");
    setFormDuration(550);
    setFormEasing("easeOut");
    setFormError("");
    setComposerOpen(true);
  };

  const openEditForm = (p: AnimationPresetDefinition) => {
    setEditingPreset(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormDesc(p.description || "");
    setFormEntrancePreset(p.config.entrance?.preset || "none");
    setFormHoverPreset(p.config.hover?.preset || "none");
    setFormDuration(p.defaultDuration || 550);
    setFormEasing(p.defaultEasing || "easeOut");
    setFormError("");
    setComposerOpen(true);
  };

  const handleSaveCustom = () => {
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError("Preset name is required.");
      return;
    }
    const config: ElementMotionConfig = {
      schemaVersion: 1,
      enabled: true,
      ...(formEntrancePreset !== "none"
        ? {
            entrance: {
              enabled: true,
              preset: formEntrancePreset,
              trigger: "viewport",
              duration: formDuration,
              delay: 0,
              easing: formEasing,
              repeat: 1,
              threshold: 0.15,
            },
          }
        : {}),
      ...(formHoverPreset !== "none"
        ? {
            hover: {
              enabled: true,
              preset: formHoverPreset,
              duration: Math.min(formDuration, 350),
              easing: formEasing,
            },
          }
        : {}),
    };
    if (!config.entrance && !config.hover) {
      config.entrance = {
        enabled: true,
        preset: "fadeInUp",
        trigger: "viewport",
        duration: formDuration,
        easing: formEasing,
      };
    }

    if (editingPreset && !editingPreset.isSystem) {
      updateMutation.mutate({
        id: editingPreset.id,
        name: cleanName,
        category: formCategory,
        description: formDesc.trim(),
        config,
        expectedVersion: editingPreset.version,
      });
    } else {
      createMutation.mutate({
        name: cleanName,
        category: formCategory,
        description: formDesc.trim(),
        config,
      });
    }
  };

  const handleDuplicate = (p: AnimationPresetDefinition) => {
    if (!canWrite) return;
    createMutation.mutate({
      name: `${p.name} Copy`.slice(0, 120),
      category: p.category === "custom" ? "custom" : p.category,
      description: p.description,
      config: p.config,
    });
  };

  const toggleFav = (p: AnimationPresetDefinition) => {
    const next = !isPresetFavorite(p);
    setLocalFavorites((prev) => ({ ...prev, [p.id]: next }));
    if (!p.isSystem && canWrite) {
      updateMutation.mutate({ id: p.id, favorite: next, expectedVersion: p.version });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" aria-label="Animation Library">
        <DialogHeader>
          <div className="ed-motion-lib-head-row">
            <div>
              <DialogTitle>Animation Library</DialogTitle>
              <DialogDescription>
                Preview, apply, favorite, or create reusable global motion presets ({SYSTEM_ANIMATION_PRESETS.length} built-in · {customPresets.length} custom).
              </DialogDescription>
            </div>
            {canWrite ? (
              <Button size="sm" variant="primary" onClick={openCreateForm}>
                <Plus size={13} />
                <span>New Custom Preset</span>
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="ed-motion-lib-toolbar">
            <div className="ed-motion-lib-tabs" role="tablist" aria-label="Animation categories">
              {LIBRARY_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={cn("ed-cat-chip", tab === t.id && "active")}
                  onClick={() => {
                    setTab(t.id);
                    setComposerOpen(false);
                  }}
                >
                  {t.label}
                  {t.id === "custom" ? ` (${customPresets.length})` : ""}
                </button>
              ))}
            </div>

            <div className="ed-motion-lib-filters">
              <label className="ed-motion-lib-search">
                <Search size={13} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search presets…"
                  aria-label="Search animation presets"
                />
              </label>
              <button
                type="button"
                className={cn("ed-cat-chip", favoritesOnly && "active")}
                onClick={() => setFavoritesOnly((f) => !f)}
              >
                <Star size={11} />
                <span>Favorites</span>
              </button>
            </div>
          </div>

          {/* Uniform fixed-height content container -> 0px layout shift across category tabs */}
          <div className="ed-motion-lib-fixed-stage">
            {composerOpen ? (
              <div className="ed-motion-composer">
                <div className="ed-inspector-sec-head">
                  <strong>
                    {editingPreset ? `Edit "${editingPreset.name}"` : "Create Custom Animation Preset"}
                  </strong>
                  <Button size="sm" variant="ghost" onClick={() => setComposerOpen(false)}>
                    Back to library
                  </Button>
                </div>
                <div className="ed-motion-composer-grid">
                  <label className="ed-ctrl-field">
                    <span className="ed-ctrl-label">Preset Name</span>
                    <input
                      className="ed-text-input"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Hero Gentle Rise"
                    />
                  </label>
                  <label className="ed-ctrl-field">
                    <span className="ed-ctrl-label">Category</span>
                    <select
                      className="ed-text-input"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as MotionCategory)}
                    >
                      <option value="entrance">Entrance</option>
                      <option value="hover">Hover</option>
                      <option value="scroll">Scroll</option>
                      <option value="interaction">Interaction</option>
                      <option value="continuous">Continuous</option>
                      <option value="text">Text</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="ed-ctrl-field">
                    <span className="ed-ctrl-label">Entrance Motion</span>
                    <select
                      className="ed-text-input"
                      value={formEntrancePreset}
                      onChange={(e) => setFormEntrancePreset(e.target.value as EntrancePresetKey)}
                    >
                      <option value="none">None</option>
                      {getPresetsByCategory("entrance").map((p) => (
                        <option key={p.presetKey} value={p.presetKey}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ed-ctrl-field">
                    <span className="ed-ctrl-label">Hover Motion</span>
                    <select
                      className="ed-text-input"
                      value={formHoverPreset}
                      onChange={(e) => setFormHoverPreset(e.target.value as HoverPresetKey)}
                    >
                      <option value="none">None</option>
                      {getPresetsByCategory("hover").map((p) => (
                        <option key={p.presetKey} value={p.config.hover?.preset || "scaleUp"}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ed-ctrl-field">
                    <span className="ed-ctrl-label">Duration (ms)</span>
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      step={50}
                      className="ed-text-input"
                      value={formDuration}
                      onChange={(e) => setFormDuration(Number(e.target.value) || 500)}
                    />
                  </label>
                  <label className="ed-ctrl-field">
                    <span className="ed-ctrl-label">Easing</span>
                    <select
                      className="ed-text-input"
                      value={formEasing}
                      onChange={(e) => setFormEasing(e.target.value)}
                    >
                      <option value="easeOut">Ease Out</option>
                      <option value="easeInOut">Ease In Out</option>
                      <option value="easeIn">Ease In</option>
                      <option value="spring">Spring</option>
                      <option value="linear">Linear</option>
                      <option value="custom">Global Custom Bezier</option>
                    </select>
                  </label>
                  <label className="ed-ctrl-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="ed-ctrl-label">Description</span>
                    <input
                      className="ed-text-input"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="Short note describing where to use this motion preset"
                    />
                  </label>
                </div>
                {formError ? <p className="ed-form-err">{formError}</p> : null}
                <div className="ed-inline-actions" style={{ marginTop: 12 }}>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    onClick={handleSaveCustom}
                  >
                    <Sparkles size={13} />
                    <span>{editingPreset ? "Save Changes" : "Create Preset"}</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setComposerOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : filteredPresets.length === 0 ? (
              <div className="ed-motion-lib-empty">
                <p className="muted">No animation presets match the current filter.</p>
                {tab === "custom" && canWrite ? (
                  <Button size="sm" variant="primary" onClick={openCreateForm}>
                    <Plus size={13} /> Create your first custom preset
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="ed-motion-lib-grid">
                {filteredPresets.map((preset) => {
                  const fav = isPresetFavorite(preset);
                  return (
                    <div
                      key={preset.id}
                      className="ed-motion-preset-card"
                      onMouseEnter={() =>
                        setReplayTicks((prev) => ({
                          ...prev,
                          [preset.id]: (prev[preset.id] || 0) + 1,
                        }))
                      }
                    >
                      <div className="ed-motion-card-top">
                        <PresetMiniPreview
                          preset={preset}
                          replayTick={replayTicks[preset.id] || 0}
                        />
                        <div className="ed-motion-card-actions">
                          <button
                            type="button"
                            className="ed-mini-icon-btn"
                            title="Replay preview"
                            onClick={() =>
                              setReplayTicks((prev) => ({
                                ...prev,
                                [preset.id]: (prev[preset.id] || 0) + 1,
                              }))
                            }
                          >
                            <Play size={11} />
                          </button>
                          <button
                            type="button"
                            className={cn("ed-mini-icon-btn", fav && "is-fav")}
                            title={fav ? "Remove favorite" : "Favorite preset"}
                            onClick={() => toggleFav(preset)}
                          >
                            <Star size={11} fill={fav ? "currentColor" : "none"} />
                          </button>
                          {canWrite ? (
                            <button
                              type="button"
                              className="ed-mini-icon-btn"
                              title="Duplicate as custom preset"
                              onClick={() => handleDuplicate(preset)}
                            >
                              <Copy size={11} />
                            </button>
                          ) : null}
                          {!preset.isSystem && canWrite ? (
                            <>
                              <button
                                type="button"
                                className="ed-mini-icon-btn"
                                title="Edit custom preset"
                                onClick={() => openEditForm(preset)}
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                className="ed-mini-icon-btn"
                                title="Delete custom preset"
                                onClick={() => deleteMutation.mutate(preset.id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="ed-motion-card-body">
                        <div className="ed-motion-card-title-row">
                          <strong>{preset.name}</strong>
                          <Badge tone={preset.isSystem ? "neutral" : "accent"}>
                            {preset.category}
                          </Badge>
                        </div>
                        <p className="muted ed-motion-card-desc">{preset.description}</p>
                        <div className="ed-motion-card-foot">
                          <span className="muted">{preset.defaultDuration}ms · {preset.defaultEasing}</span>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              onApplyPreset(preset);
                              onOpenChange(false);
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
