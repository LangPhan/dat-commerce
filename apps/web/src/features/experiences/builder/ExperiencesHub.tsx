"use client";

import { revalidateStorefrontCache } from "@/lib/revalidate-store";
import { STORE_CACHE_TAGS } from "@/lib/store-cache-tags";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Copy,
  ExternalLink,
  Layers,
  Plus,
  Power,
  Rocket,
  Sliders,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { formatDateTime } from "@/lib/format";
import { experienceAdminApi } from "../api";
import type {
  ConflictStrategy,
  ExperienceCategory,
  ExperienceTemplateDto,
  FallbackBehavior,
  MobilePerformanceMode,
} from "../types";

type HubTab = "templates" | "experiences" | "schedule";

const CATEGORY_FILTERS: { key: ExperienceCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Events" },
  { key: "SEASON", label: "Seasons" },
  { key: "HOLIDAY", label: "Holidays" },
  { key: "CULTURAL", label: "Cultural" },
  { key: "OCCASION", label: "Special Occasions" },
  { key: "CAMPAIGN", label: "Campaigns" },
  { key: "FLASH_SALE", label: "Flash Sales" },
  { key: "CUSTOM", label: "Custom" },
];

export function ExperiencesHub({
  notify,
}: {
  notify: (msg: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const canPublish = hasPermission("content:publish");

  const [tab, setTab] = useState<HubTab>("templates");
  const [catFilter, setCatFilter] = useState<ExperienceCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<ExperienceCategory>("CUSTOM");
  const [customDesc, setCustomDesc] = useState("");

  const [simAt, setSimAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [simRoute, setSimRoute] = useState("/");

  const templatesQuery = useQuery({
    queryKey: ["admin-experience-templates"],
    queryFn: () => experienceAdminApi.listTemplates(),
    staleTime: 300_000,
  });

  const listQuery = useQuery({
    queryKey: ["admin-experiences"],
    queryFn: () => experienceAdminApi.list(),
  });

  const settingsQuery = useQuery({
    queryKey: ["admin-experience-settings"],
    queryFn: () => experienceAdminApi.getSettings(),
  });

  const liveSimQuery = useQuery({
    queryKey: ["admin-experience-live-sim"],
    queryFn: () => experienceAdminApi.simulate(),
    refetchInterval: 30_000,
  });

  const customSimQuery = useQuery({
    queryKey: ["admin-experience-time-sim", simAt, simRoute],
    queryFn: () =>
      experienceAdminApi.simulate(
        simAt ? new Date(simAt).toISOString() : undefined,
        simRoute || undefined
      ),
    enabled: tab === "schedule",
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      name: string;
      category?: string;
      description?: string;
      presetKey?: string;
    }) => experienceAdminApi.create(body),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      setCustomOpen(false);
      setCustomName("");
      setCustomDesc("");
      notify(`Created "${created.name}"`);
      router.push(`/admin/experiences/${created.id}`);
    },
    onError: (err) =>
      notify(err instanceof Error ? err.message : "Could not create experience"),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => experienceAdminApi.activate(id),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-experience-live-sim"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      notify(`"${updated.name}" is now LIVE on storefront`);
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Activation failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => experienceAdminApi.deactivate(id),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-experience-live-sim"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      notify(`Paused "${updated.name}"`);
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Deactivation failed"),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => experienceAdminApi.duplicate(id),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      notify(`Duplicated "${copy.name}"`);
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Duplicate failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => experienceAdminApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-experience-live-sim"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      notify("Deleted experience");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Delete failed"),
  });

  const settingsMutation = useMutation({
    mutationFn: experienceAdminApi.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin-experience-settings"], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-experience-live-sim"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      notify("Updated seasonal interaction & performance settings");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Settings update failed"),
  });

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (templatesQuery.data || []).filter((tpl) => {
      if (catFilter !== "ALL" && tpl.category !== catFilter) return false;
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [templatesQuery.data, catFilter, search]);

  const filteredExperiences = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQuery.data || []).filter((exp) => {
      if (catFilter !== "ALL" && exp.category !== catFilter) return false;
      if (!q) return true;
      return (
        exp.name.toLowerCase().includes(q) ||
        (exp.description || "").toLowerCase().includes(q)
      );
    });
  }, [listQuery.data, catFilter, search]);

  const scheduledTimeline = useMemo(
    () =>
      (listQuery.data || [])
        .filter((e) => e.activationMode === "SCHEDULED" || e.status === "ACTIVE")
        .slice()
        .sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || "")),
    [listQuery.data]
  );

  const liveActive = liveSimQuery.data?.activeExperiences || [];
  const settings = settingsQuery.data;

  const handleUseTemplate = (tpl: ExperienceTemplateDto) => {
    if (!canWrite) return;
    createMutation.mutate({
      name: tpl.name,
      category: tpl.category,
      description: tpl.description,
      presetKey: tpl.presetKey,
    });
  };

  return (
    <div className="exp-hub">
      <div className="admin-title">
        <div>
          <h1>Seasonal &amp; Event Experience Builder</h1>
          <p>
            Transform your entire storefront for seasons, holidays, cultural events, and flash sales with drag-and-drop effects, AI design, and automated scheduling.
          </p>
        </div>
        <div className="button-row">
          <Link href="/" target="_blank" className="btn">
            <ExternalLink size={14} /> View Live Storefront
          </Link>
          {canWrite ? (
            <Button variant="primary" onClick={() => setCustomOpen(true)}>
              <Plus size={14} /> Create Custom Event
            </Button>
          ) : null}
        </div>
      </div>

      {/* Live Status Hero */}
      <section className="exp-live-hero">
        <div className="exp-live-hero-left">
          <div className="exp-live-dot-row">
            <span
              className={`exp-live-dot${settings?.enabled === false ? " is-off" : liveActive.length > 0 ? " is-live" : ""}`}
            />
            <strong>
              {settings?.enabled === false
                ? "Seasonal Engine Disabled (Global Kill-Switch)"
                : liveActive.length > 0
                  ? `${liveActive.length} Experience(s) Live on Storefront`
                  : "Default Base Storefront Active"}
            </strong>
          </div>
          <p>
            {liveActive.length > 0
              ? `Running: ${liveActive.map((a) => `${a.name} (P${a.priority}, ${a.blendMode})`).join(" + ")}`
              : "No seasonal overlay is currently live. Pick a template or activate an experience below."}
            {liveSimQuery.data?.nextTransitionAt
              ? ` · Next automatic schedule transition: ${formatDateTime(liveSimQuery.data.nextTransitionAt)}`
              : ""}
          </p>
        </div>
        {canWrite && settings ? (
          <div className="exp-live-hero-actions">
            <Button
              size="sm"
              onClick={() =>
                settingsMutation.mutate({ enabled: !settings.enabled })
              }
              disabled={settingsMutation.isPending}
            >
              <Power size={13} />
              {settings.enabled ? "Disable All Effects" : "Enable Engine"}
            </Button>
          </div>
        ) : null}
      </section>

      {/* Hub Navigation Tabs & Filter Bar */}
      <div className="exp-hub-toolbar">
        <div className="exp-hub-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "templates"}
            className={`exp-hub-tab${tab === "templates" ? " active" : ""}`}
            onClick={() => setTab("templates")}
          >
            <Wand2 size={14} />
            <span>Templates Gallery ({templatesQuery.data?.length || 10})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "experiences"}
            className={`exp-hub-tab${tab === "experiences" ? " active" : ""}`}
            onClick={() => setTab("experiences")}
          >
            <Layers size={14} />
            <span>Store Experiences ({listQuery.data?.length || 0})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "schedule"}
            className={`exp-hub-tab${tab === "schedule" ? " active" : ""}`}
            onClick={() => setTab("schedule")}
          >
            <CalendarClock size={14} />
            <span>Schedule &amp; Conflict Simulator</span>
          </button>
        </div>

        {tab !== "schedule" ? (
          <input
            type="search"
            className="exp-hub-search"
            placeholder="Filter by event, holiday, effect..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : null}
      </div>

      {tab !== "schedule" ? (
        <div className="exp-hub-cats">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`exp-cat-pill${catFilter === cat.key ? " active" : ""}`}
              onClick={() => setCatFilter(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="exp-hub-scroll">
        {/* Tab 1: Predefined Templates */}
        {tab === "templates" ? (
        templatesQuery.isLoading ? (
          <Skeleton rows={6} />
        ) : (
            <div className="exp-template-grid">
            {filteredTemplates.map((tpl) => (
              <article key={tpl.presetKey} className="exp-template-card">
                <div
                  className="exp-template-banner"
                  style={{ background: tpl.previewGradient }}
                >
                  <Badge tone="neutral">{tpl.category}</Badge>
                  <span className="exp-template-layers-pill">
                    {tpl.config.layers.length} effects
                  </span>
                </div>
                <div className="exp-template-body">
                  <h3>{tpl.name}</h3>
                  <p>{tpl.description}</p>
                  <div className="exp-template-tags">
                    {tpl.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="exp-template-foot">
                  <small>
                    Priority {tpl.defaultPriority} · {tpl.defaultBlendMode}
                  </small>
                  {canWrite ? (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={createMutation.isPending}
                      onClick={() => handleUseTemplate(tpl)}
                    >
                      <Sparkles size={13} />
                      Use Template
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {/* Tab 2: Store Experiences */}
      {tab === "experiences" ? (
        listQuery.isLoading ? (
          <Skeleton rows={6} />
        ) : filteredExperiences.length === 0 ? (
          <Empty
            icon={<Sparkles size={26} />}
            title="No experiences match your filter"
            text="Create a custom experience or instantiate one of the 10 seasonal templates."
          />
        ) : (
          <div className="exp-list-grid">
            {filteredExperiences.map((exp) => {
              const isActive = exp.status === "ACTIVE";
              return (
                <article key={exp.id} className="exp-item-card">
                  <div className="exp-item-head">
                    <div>
                      <div className="exp-item-badges">
                        <StatusBadge status={exp.status} />
                        <Badge tone="neutral">{exp.category}</Badge>
                        <Badge tone="accent">P{exp.priority} · {exp.blendMode}</Badge>
                      </div>
                      <h3>{exp.name}</h3>
                    </div>
                    <span className="exp-ver-pill">v{exp.latestVersionNumber}</span>
                  </div>
                  <p className="exp-item-desc">
                    {exp.description || "Custom storefront seasonal experience."}
                  </p>
                  <div className="exp-item-meta">
                    <span>{exp.layerCount} visual layer(s)</span>
                    <span>Routes: {exp.targetPages.join(", ")}</span>
                    {exp.startsAt ? (
                      <span>
                        Window: {formatDateTime(exp.startsAt)}
                        {exp.endsAt ? ` → ${formatDateTime(exp.endsAt)}` : ""}
                      </span>
                    ) : (
                      <span>Activation: Manual</span>
                    )}
                  </div>
                  <div className="exp-item-actions">
                    <Link
                      href={`/admin/experiences/${exp.id}`}
                      className="btn primary btn-sm"
                    >
                      <Sliders size={13} /> Open Visual Studio
                    </Link>

                    {canPublish ? (
                      isActive ? (
                        <Button
                          size="sm"
                          disabled={deactivateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(exp.id)}
                        >
                          <Power size={13} /> Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={activateMutation.isPending}
                          onClick={() => activateMutation.mutate(exp.id)}
                        >
                          <Rocket size={13} /> Activate
                        </Button>
                      )
                    ) : null}

                    {canWrite ? (
                      <>
                        <Button
                          size="sm"
                          disabled={duplicateMutation.isPending}
                          onClick={() => duplicateMutation.mutate(exp.id)}
                          title="Duplicate"
                        >
                          <Copy size={13} />
                        </Button>
                        <Button
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(exp.id)}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : null}

      {/* Tab 3: Schedule Timeline & Conflict Simulator */}
      {tab === "schedule" ? (
        <div className="exp-schedule-grid">
          <div className="exp-panel-card">
            <h2>Store-Wide Interaction &amp; Performance Policy</h2>
            <p>
              Control how overlapping events stack, conflict, and scale particle budgets across devices.
            </p>
            {settings ? (
              <div className="exp-settings-form">
                <label className="exp-field">
                  <span>Conflict Resolution Strategy</span>
                  <select
                    value={settings.conflictStrategy}
                    disabled={!canWrite || settingsMutation.isPending}
                    onChange={(e) =>
                      settingsMutation.mutate({
                        conflictStrategy: e.target.value as ConflictStrategy,
                      })
                    }
                  >
                    <option value="PRIORITY_STACK">
                      Priority Stack (Compose non-conflicting layers)
                    </option>
                    <option value="SINGLE_HIGHEST_PRIORITY">
                      Single Highest Priority Only
                    </option>
                    <option value="MANUAL_WINS_OVER_SCHEDULED">
                      Manual Activations Always Win Over Scheduled
                    </option>
                  </select>
                </label>

                <div className="exp-two-col">
                  <label className="exp-field">
                    <span>Max Concurrent Events</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={settings.maxConcurrentExperiences}
                      disabled={!canWrite}
                      onChange={(e) =>
                        settingsMutation.mutate({
                          maxConcurrentExperiences: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="exp-field">
                    <span>Global Particle Cap</span>
                    <input
                      type="number"
                      min={20}
                      max={400}
                      step={10}
                      value={settings.globalParticleCap}
                      disabled={!canWrite}
                      onChange={(e) =>
                        settingsMutation.mutate({
                          globalParticleCap: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="exp-two-col">
                  <label className="exp-field">
                    <span>Mobile Performance Mode</span>
                    <select
                      value={settings.mobilePerformanceMode}
                      disabled={!canWrite}
                      onChange={(e) =>
                        settingsMutation.mutate({
                          mobilePerformanceMode: e.target.value as MobilePerformanceMode,
                        })
                      }
                    >
                      <option value="ADAPTIVE">Adaptive (50% density)</option>
                      <option value="MINIMAL">Minimal (25% density)</option>
                      <option value="FULL">Full Desktop Fidelity</option>
                      <option value="OFF">Disable Particles on Mobile</option>
                    </select>
                  </label>
                  <label className="exp-field">
                    <span>When Scheduled Event Ends</span>
                    <select
                      value={settings.fallbackBehavior}
                      disabled={!canWrite}
                      onChange={(e) =>
                        settingsMutation.mutate({
                          fallbackBehavior: e.target.value as FallbackBehavior,
                        })
                      }
                    >
                      <option value="REVERT_DEFAULT_THEME">
                        Revert to Base Storefront Theme
                      </option>
                      <option value="ACTIVATE_NEXT_SCHEDULED">
                        Activate Next Scheduled Event
                      </option>
                      <option value="KEEP_SEASONAL_BASE">
                        Fall Back to Default Seasonal Experience
                      </option>
                    </select>
                  </label>
                </div>

                <label className="exp-check-row">
                  <input
                    type="checkbox"
                    checked={settings.allowCustomerDismiss}
                    disabled={!canWrite}
                    onChange={(e) =>
                      settingsMutation.mutate({
                        allowCustomerDismiss: e.target.checked,
                      })
                    }
                  />
                  <span>Show subtle &ldquo;Pause effects&rdquo; button to shoppers</span>
                </label>
              </div>
            ) : (
              <Skeleton rows={4} />
            )}
          </div>

          <div className="exp-panel-card">
            <h2>Time-Travel Composition Simulator</h2>
            <p>
              Test how active and scheduled experiences combine at any future date &amp; storefront route.
            </p>
            <div className="exp-two-col">
              <label className="exp-field">
                <span>Simulate Date &amp; Time</span>
                <input
                  type="datetime-local"
                  value={simAt}
                  onChange={(e) => setSimAt(e.target.value)}
                />
              </label>
              <label className="exp-field">
                <span>Storefront Route</span>
                <input
                  type="text"
                  value={simRoute}
                  onChange={(e) => setSimRoute(e.target.value)}
                  placeholder="/ or /store/shop"
                />
              </label>
            </div>

            {customSimQuery.data ? (
              <div className="exp-sim-result">
                <div className="exp-sim-summary">
                  <strong>
                    Active Winners ({customSimQuery.data.activeExperiences.length}):
                  </strong>{" "}
                  {customSimQuery.data.activeExperiences.length > 0
                    ? customSimQuery.data.activeExperiences
                        .map((a) => `${a.name} [P${a.priority}·${a.blendMode}]`)
                        .join(" + ")
                    : "None (Base Storefront)"}
                </div>
                <div className="exp-sim-layers">
                  <strong>
                    Composed Layers ({customSimQuery.data.layers.length})
                  </strong>
                  <ul>
                    {customSimQuery.data.layers.map((l) => (
                      <li key={`${l.sourceExperienceId}-${l.id}`}>
                        <span>{l.label}</span>
                        <small>
                          from {l.sourceExperienceName} · {l.zone}
                          {l.effectiveDensityScale < 1
                            ? ` · scaled ${Math.round(l.effectiveDensityScale * 100)}%`
                            : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="exp-sim-trace">
                  <strong>Resolution Trace</strong>
                  <ul>
                    {customSimQuery.data.resolutionTrace.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>

          <div className="exp-panel-card exp-timeline-span">
            <h2>Scheduled &amp; Active Timeline</h2>
            {scheduledTimeline.length === 0 ? (
              <p className="exp-muted-note">
                No experiences are currently active or scheduled. Open any experience in the Studio and arm a schedule window.
              </p>
            ) : (
              <div className="exp-timeline-list">
                {scheduledTimeline.map((item) => (
                  <div key={item.id} className="exp-timeline-row">
                    <div>
                      <div className="exp-item-badges">
                        <StatusBadge status={item.status} />
                        <Badge tone="accent">P{item.priority} · {item.blendMode}</Badge>
                      </div>
                      <strong>{item.name}</strong>
                    </div>
                    <div className="exp-timeline-dates">
                      <span>
                        {item.startsAt ? formatDateTime(item.startsAt) : "Immediate (Manual)"}
                      </span>
                      <span>→</span>
                      <span>
                        {item.endsAt ? formatDateTime(item.endsAt) : "No end date"}
                      </span>
                    </div>
                    <Link
                      href={`/admin/experiences/${item.id}`}
                      className="btn btn-sm"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
      </div>

      {/* Custom Experience Creation Dialog */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Event Experience</DialogTitle>
            <DialogDescription>
              Start from a blank canvas and drag effects or use the AI Creative Director in the Studio.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="exp-pop-form">
              <label>
                <span>Experience Name</span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Anniversary Week Gold Drop"
                />
              </label>
              <label>
                <span>Event Category</span>
                <select
                  value={customCategory}
                  onChange={(e) =>
                    setCustomCategory(e.target.value as ExperienceCategory)
                  }
                >
                  <option value="CUSTOM">Custom Event</option>
                  <option value="SEASON">Season</option>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="CULTURAL">Cultural Event</option>
                  <option value="OCCASION">Special Occasion</option>
                  <option value="CAMPAIGN">Marketing Campaign</option>
                  <option value="FLASH_SALE">Flash Sale</option>
                </select>
              </label>
              <label>
                <span>Description</span>
                <textarea
                  rows={3}
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Short description of this storefront transformation..."
                />
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setCustomOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!customName.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: customName.trim(),
                  category: customCategory,
                  description: customDesc.trim() || undefined,
                })
              }
            >
              {createMutation.isPending ? "Creating..." : "Create & Open Studio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
