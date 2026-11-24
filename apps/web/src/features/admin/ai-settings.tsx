"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { cn } from "@/lib/format";
import type { AiModelSettingsDto, AvailableModelDto } from "@/types/api-cms-ai";

type CapabilityFilter = "all" | "selected" | "tools" | "reasoning" | "vision";

function formatContextWindow(tokens?: number | null): string | null {
  if (!tokens || tokens <= 0) return null;
  if (tokens >= 1_000_000) {
    return `${Math.round(tokens / 100_000) / 10}M ctx`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K ctx`;
  }
  return `${tokens} ctx`;
}

export function AiModelSettingsPanel({
  notify,
  onSaved,
  compact = false,
}: {
  notify?: (msg: string) => void;
  onSaved?: (settings: AiModelSettingsDto) => void;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CapabilityFilter>("all");
  const [draftIds, setDraftIds] = useState<string[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: () => aiAdminApi.getSettings(),
  });

  const serverEnabled = useMemo(
    () => settingsQuery.data?.enabledModelIds ?? [],
    [settingsQuery.data]
  );
  const availableModels = useMemo(
    () => settingsQuery.data?.availableModels ?? [],
    [settingsQuery.data]
  );

  const currentIds = draftIds ?? serverEnabled;
  const enabledSet = useMemo(() => new Set(currentIds), [currentIds]);

  const modelMap = useMemo(() => {
    const map = new Map<string, AvailableModelDto>();
    for (const m of availableModels) {
      map.set(m.id, m);
    }
    return map;
  }, [availableModels]);

  const isDirty = useMemo(() => {
    if (currentIds.length !== serverEnabled.length) return true;
    return currentIds.some((id, idx) => id !== serverEnabled[idx]);
  }, [currentIds, serverEnabled]);

  const saveMutation = useMutation({
    mutationFn: (enabledModelIds: string[]) =>
      aiAdminApi.updateSettings({ enabledModelIds }),
    onSuccess: (updated) => {
      setErrorMsg(null);
      setDraftIds(null);
      queryClient.setQueryData(["admin-ai-settings"], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-settings"] });
      notify?.(
        `AI model settings saved. Default model: ${updated.defaultModelId}`
      );
      onSaved?.(updated);
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to save AI settings"
      );
    },
  });

  const movePriority = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= currentIds.length) return;
    const next = [...currentIds];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    setDraftIds(next);
    setErrorMsg(null);
  };

  const toggleModel = (modelId: string) => {
    if (enabledSet.has(modelId)) {
      if (currentIds.length <= 1) {
        setErrorMsg("At least one model must stay enabled for the AI bar.");
        return;
      }
      setDraftIds(currentIds.filter((id) => id !== modelId));
      setErrorMsg(null);
    } else {
      if (currentIds.length >= 30) {
        setErrorMsg("At most 30 models can be enabled at once.");
        return;
      }
      setDraftIds([...currentIds, modelId]);
      setErrorMsg(null);
    }
  };

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableModels.filter((model) => {
      if (filter === "selected" && !enabledSet.has(model.id)) return false;
      if (filter === "tools" && !model.tools) return false;
      if (filter === "reasoning" && !model.reasoning) return false;
      if (filter === "vision" && !model.vision) return false;
      if (!q) return true;
      return (
        model.id.toLowerCase().includes(q) ||
        model.label.toLowerCase().includes(q) ||
        model.ownedBy.toLowerCase().includes(q)
      );
    });
  }, [availableModels, enabledSet, filter, search]);

  if (settingsQuery.isLoading) {
    return <Skeleton rows={6} />;
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <Empty
        icon={<Bot size={20} />}
        title="Unable to load AI model settings"
        text={
          settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : "Check gateway connectivity or permissions."
        }
        action={
          <Button
            onClick={() => {
              void settingsQuery.refetch();
            }}
          >
            <RefreshCw size={14} /> Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className={cn("ai-settings-root", compact && "compact")}>
      {!settingsQuery.data.gatewayReachable ? (
        <div className="ai-settings-banner warn" role="status">
          <WifiOff size={15} />
          <div>
            <strong>AI Gateway catalog offline</strong>
            <p>
              {settingsQuery.data.gatewayError ||
                "Showing persisted models only. Reconnect 9Router to browse the full model catalog."}
            </p>
          </div>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="ai-settings-banner error" role="alert">
          <span>{errorMsg}</span>
        </div>
      ) : null}

      <div className="ai-settings-grid">
        <section className="card ai-settings-card">
          <div className="ai-settings-card-head">
            <div>
              <h2>Floating AI Bar Priority</h2>
              <p className="muted">
                Priority <strong>#1</strong> is selected by default on the
                canvas Floating AI Bar. Use Up / Down to reorder.
              </p>
            </div>
            <Badge tone="accent">{currentIds.length} enabled</Badge>
          </div>

          <div className="ai-priority-list" role="list" aria-label="Selected AI models in priority order">
            {currentIds.map((id, index) => {
              const info = modelMap.get(id);
              const label = info?.label || id;
              const ownedBy = info?.ownedBy || "gateway";
              const ctxText = formatContextWindow(info?.contextLength);
              return (
                <div
                  key={id}
                  role="listitem"
                  className={cn(
                    "ai-priority-row",
                    index === 0 && "is-default"
                  )}
                >
                  <div className="ai-priority-rank">
                    <span>#{index + 1}</span>
                  </div>

                  <div className="ai-priority-info">
                    <div className="ai-priority-title">
                      <strong>{label}</strong>
                      {index === 0 ? (
                        <Badge tone="green">
                          <Sparkles size={10} /> Default
                        </Badge>
                      ) : null}
                      {info?.reasoning ? (
                        <Badge tone="neutral">Reasoning</Badge>
                      ) : null}
                    </div>
                    <div className="ai-priority-meta">
                      <code>{id}</code>
                      <span>· {ownedBy}</span>
                      {ctxText ? <span>· {ctxText}</span> : null}
                    </div>
                  </div>

                  <div className="ai-priority-actions">
                    <IconButton
                      label={`Move ${label} up`}
                      disabled={index === 0 || saveMutation.isPending}
                      onClick={() => movePriority(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </IconButton>
                    <IconButton
                      label={`Move ${label} down`}
                      disabled={
                        index === currentIds.length - 1 ||
                        saveMutation.isPending
                      }
                      onClick={() => movePriority(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </IconButton>
                    <IconButton
                      label={`Remove ${label} from AI bar`}
                      disabled={
                        currentIds.length <= 1 || saveMutation.isPending
                      }
                      onClick={() => toggleModel(id)}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ai-settings-footer">
            <Button
              size="sm"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => {
                setDraftIds(null);
                setErrorMsg(null);
              }}
            >
              <RotateCcw size={13} /> Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate(currentIds)}
            >
              <Save size={13} />
              {saveMutation.isPending ? "Saving..." : "Save priority"}
            </Button>
          </div>
        </section>

        <section className="card ai-settings-card">
          <div className="ai-settings-card-head">
            <div>
              <h2>Available Gateway Models</h2>
              <p className="muted">
                All models reported by 9Router ({availableModels.length}{" "}
                discovered). Toggle which models appear in the Floating AI Bar.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                void settingsQuery.refetch();
              }}
              disabled={settingsQuery.isFetching}
            >
              <RefreshCw
                size={13}
                className={settingsQuery.isFetching ? "spin" : undefined}
              />
              Refresh
            </Button>
          </div>

          <div className="ai-catalog-controls">
            <label className="search-field ai-catalog-search">
              <Search size={14} />
              <input
                aria-label="Filter available AI models"
                placeholder="Search model ID or provider..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="ai-filter-chips" role="group" aria-label="Capability filters">
              {(
                [
                  ["all", "All"],
                  ["selected", "Selected"],
                  ["tools", "Tools"],
                  ["reasoning", "Reasoning"],
                  ["vision", "Vision"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={cn("ai-filter-chip", filter === key && "active")}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ai-available-list">
            {filteredModels.length === 0 ? (
              <p className="muted" style={{ padding: "16px 8px", fontSize: 13 }}>
                No models match the current search or capability filter.
              </p>
            ) : (
              filteredModels.map((model) => {
                const selected = enabledSet.has(model.id);
                const rank = selected ? currentIds.indexOf(model.id) + 1 : null;
                const ctxText = formatContextWindow(model.contextLength);
                return (
                  <div
                    key={model.id}
                    className={cn("ai-model-row", selected && "selected")}
                  >
                    <div className="ai-model-row-main">
                      <div className="ai-model-row-title">
                        <strong>{model.label}</strong>
                        <Badge tone="neutral">{model.ownedBy}</Badge>
                        {ctxText ? (
                          <Badge tone="neutral">{ctxText}</Badge>
                        ) : null}
                        {model.vision ? (
                          <Badge tone="neutral">Vision</Badge>
                        ) : null}
                        {model.tools ? (
                          <Badge tone="accent">Tools</Badge>
                        ) : null}
                      </div>
                      <code className="ai-model-row-id">{model.id}</code>
                    </div>

                    <div className="ai-model-row-action">
                      {rank !== null ? (
                        <Badge tone="green">#{rank}</Badge>
                      ) : null}
                      <Button
                        size="sm"
                        variant={selected ? "secondary" : "primary"}
                        disabled={
                          (selected && currentIds.length <= 1) ||
                          saveMutation.isPending
                        }
                        onClick={() => toggleModel(model.id)}
                      >
                        {selected ? (
                          <>
                            <Check size={13} /> Selected
                          </>
                        ) : (
                          <>
                            <Plus size={13} /> Enable
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AiSettingsView({ notify }: { notify: (msg: string) => void }) {
  return (
    <div className="admin-page">
      <div className="admin-title">
        <div>
          <h1>AI Model Settings</h1>
          <p>
            Choose which 9Router models appear on the Visual Editor Floating AI
            Bar and set their priority order (#1 is used by default).
          </p>
        </div>
      </div>

      <AiModelSettingsPanel notify={notify} />
    </div>
  );
}
