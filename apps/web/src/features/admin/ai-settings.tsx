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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useAuth } from "@/features/auth/auth-context";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { cn } from "@/lib/format";
import type {
  AdminCustomerUsageRowDto,
  AiModelSettingsDto,
  AvailableModelDto,
  UpdateAiModelSettingsRequest,
} from "@/types/api-cms-ai";

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
  const rankByModelId = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < currentIds.length; i += 1) {
      map.set(currentIds[i], i + 1);
    }
    return map;
  }, [currentIds]);

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
    setDraftIds((prev) => {
      const base = prev ?? serverEnabled;
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= base.length) return prev;
      const next = [...base];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    setErrorMsg(null);
  };

  const toggleModel = (modelId: string) => {
    setDraftIds((prev) => {
      const base = prev ?? serverEnabled;
      if (base.includes(modelId)) {
        if (base.length <= 1) {
          setErrorMsg("At least one model must stay enabled for the AI bar.");
          return prev;
        }
        setErrorMsg(null);
        return base.filter((id) => id !== modelId);
      }
      if (base.length >= 30) {
        setErrorMsg("At most 30 models can be enabled at once.");
        return prev;
      }
      setErrorMsg(null);
      return [...base, modelId];
    });
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
              <span
                className={cn("inline-flex", settingsQuery.isFetching && "spin")}
                aria-hidden="true"
              >
                <RefreshCw size={13} />
              </span>
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
                const rank = rankByModelId.get(model.id) ?? null;
                const selected = rank !== null;
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

const DAILY_LIMIT_PRESETS = [
  { value: 10000, label: "10K" },
  { value: 20000, label: "20K (Default)" },
  { value: 50000, label: "50K" },
  { value: 100000, label: "100K" },
];

export function CustomerAiQuotaSettingsSection({
  notify,
}: {
  notify?: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canResetQuota = hasPermission("store:write");

  const settingsQuery = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: () => aiAdminApi.getSettings(),
  });

  const usageQuery = useQuery({
    queryKey: ["admin-ai-customer-usage"],
    queryFn: () => aiAdminApi.getCustomerUsage(),
  });

  const serverData = settingsQuery.data;
  const serverEnabled = serverData?.customerAiEnabled ?? true;
  const serverLimit = serverData?.dailyTokenLimitPerUser ?? 20000;
  const serverCustModel =
    serverData?.customerAiModelId || serverData?.defaultModelId || "gpt-6-luna";

  const [draftEnabled, setDraftEnabled] = useState<boolean | null>(null);
  const [draftLimit, setDraftLimit] = useState<number | null>(null);
  const [draftModel, setDraftModel] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const effectiveEnabled = draftEnabled ?? serverEnabled;
  const effectiveLimit = draftLimit ?? serverLimit;
  const effectiveModel = draftModel ?? serverCustModel;

  const isDirty =
    effectiveEnabled !== serverEnabled ||
    effectiveLimit !== serverLimit ||
    effectiveModel !== serverCustModel;

  const saveQuotaMutation = useMutation({
    mutationFn: (payload: UpdateAiModelSettingsRequest) =>
      aiAdminApi.updateSettings(payload),
    onSuccess: (updated) => {
      setErrMsg("");
      setDraftEnabled(null);
      setDraftLimit(null);
      setDraftModel(null);
      queryClient.setQueryData(["admin-ai-settings"], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-customer-usage"] });
      notify?.(
        `Saved Storefront AI policy (${updated.dailyTokenLimitPerUser?.toLocaleString() || 20000} tokens/day)`
      );
    },
    onError: (err) => {
      setErrMsg(err instanceof Error ? err.message : "Failed to save quota settings");
    },
  });

  const resetUserMutation = useMutation({
    mutationFn: (userId: string) => aiAdminApi.resetCustomerUsage(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-customer-usage"] });
      notify?.("Reset user daily AI token quota");
    },
    onError: (err) => {
      setErrMsg(err instanceof Error ? err.message : "Failed to reset user quota");
    },
  });

  const modelChoices = useMemo(() => {
    const enabled = serverData?.enabledModelIds ?? [];
    const avail = serverData?.availableModels ?? [];
    const map = new Map(avail.map((m) => [m.id, m.label]));
    const ids = enabled.length ? enabled : [serverCustModel];
    return ids.map((id) => ({ value: id, label: map.get(id) || id }));
  }, [serverData, serverCustModel]);

  const usageColumns: DataTableColumn<AdminCustomerUsageRowDto>[] = [
    {
      id: "user",
      header: "Account",
      cell: (r) => (
        <div>
          <strong>{r.fullName}</strong>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {r.email}
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (r) => (
        <Badge tone={r.accountType === "STAFF" ? "accent" : "neutral"}>
          {r.accountType}
        </Badge>
      ),
    },
    {
      id: "requests",
      header: "Requests",
      cell: (r) => r.requestCount,
    },
    {
      id: "usage",
      header: "Tokens Used Today",
      cell: (r) => {
        const pct = Math.min(100, Math.round((r.totalTokens / Math.max(1, r.dailyLimit)) * 100));
        return (
          <div className="ai-quota-cell">
            <div className="ai-quota-cell-head">
              <span>
                {r.totalTokens.toLocaleString()} / {r.dailyLimit.toLocaleString()}
              </span>
              <span className="muted">{pct}%</span>
            </div>
            <div className="ai-quota-bar">
              <div
                className={cn(
                  "ai-quota-bar-fill",
                  pct >= 100 ? "is-full" : pct >= 80 ? "is-warn" : ""
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    ...(canResetQuota
      ? [
          {
            id: "actions",
            header: "Action",
            align: "right" as const,
            cell: (r: AdminCustomerUsageRowDto) => (
              <Button
                size="sm"
                variant="ghost"
                disabled={resetUserMutation.isPending}
                onClick={() => resetUserMutation.mutate(r.userId)}
              >
                <RotateCcw size={12} /> Reset today
              </Button>
            ),
          },
        ]
      : []),
  ];

  if (settingsQuery.isLoading) {
    return <Skeleton rows={3} />;
  }

  return (
    <div className="ai-settings-customer-wrap" data-testid="customer-ai-quota-settings">
      <section className="card ai-settings-card">
        <div className="ai-settings-card-head">
          <div>
            <h2>Storefront Shopping AI &amp; Daily Token Quota</h2>
            <p className="muted">
              Require customer login and cap tokens per account per UTC day for product Q&amp;A, shopping recommendations, cart additions, and checkout prefill.
            </p>
          </div>
          <Badge tone={effectiveEnabled ? "green" : "amber"}>
            {effectiveEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        <div className="ai-customer-policy-grid">
          <label className="ed-check-row">
            <input
              type="checkbox"
              checked={effectiveEnabled}
              onChange={(e) => setDraftEnabled(e.target.checked)}
            />
            <span>Enable Storefront Shopping AI for signed-in users</span>
          </label>

          <div className="ui-field">
            <label className="ui-field-label" htmlFor="daily-token-limit-input">
              Daily Token Limit per Account (1,000 – 500,000)
            </label>
            <div className="ai-limit-row">
              <input
                id="daily-token-limit-input"
                type="number"
                min={1000}
                max={500000}
                step={1000}
                value={effectiveLimit}
                onChange={(e) =>
                  setDraftLimit(Math.max(0, parseInt(e.target.value || "0", 10)))
                }
              />
              <div className="ai-limit-presets">
                {DAILY_LIMIT_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={cn(
                      "ai-filter-chip",
                      effectiveLimit === p.value && "active"
                    )}
                    onClick={() => setDraftLimit(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ui-field">
            <span className="ui-field-label">Customer Shopping AI Model</span>
            <Select
              items={modelChoices}
              value={
                modelChoices.some((m) => m.value === effectiveModel)
                  ? effectiveModel
                  : modelChoices[0]?.value || ""
              }
              onValueChange={(next) => {
                if (next) setDraftModel(next);
              }}
            >
              <SelectTrigger aria-label="Customer AI model" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelChoices.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {errMsg ? (
          <p className="danger" role="alert" style={{ margin: 0, fontSize: 12.5 }}>
            {errMsg}
          </p>
        ) : null}

        <div className="ai-settings-footer">
          <Button
            size="sm"
            disabled={!isDirty || saveQuotaMutation.isPending}
            onClick={() => {
              setDraftEnabled(null);
              setDraftLimit(null);
              setDraftModel(null);
              setErrMsg("");
            }}
          >
            <RotateCcw size={13} /> Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={
              !isDirty ||
              saveQuotaMutation.isPending ||
              effectiveLimit < 1000 ||
              effectiveLimit > 500000 ||
              !(serverData?.enabledModelIds?.length)
            }
            onClick={() =>
              saveQuotaMutation.mutate({
                enabledModelIds: serverData?.enabledModelIds || [effectiveModel],
                customerAiEnabled: effectiveEnabled,
                dailyTokenLimitPerUser: effectiveLimit,
                customerAiModelId: effectiveModel,
              })
            }
          >
            <Save size={13} />
            {saveQuotaMutation.isPending ? "Saving..." : "Save Customer AI Policy"}
          </Button>
        </div>
      </section>

      <DataTable
        title="Today's AI Token Usage by Account"
        columns={usageColumns}
        data={usageQuery.data || []}
        getRowKey={(r) => r.userId}
        pageSize={8}
        emptyState={<p className="muted">No customer AI token consumption recorded today yet.</p>}
      />
    </div>
  );
}

export function AiSettingsView({ notify }: { notify: (msg: string) => void }) {
  const { hasPermission } = useAuth();
  const canManageAiSettings = hasPermission("ai:settings:write");

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>AI Model Settings</h1>
          <p>
            Configure 9Router model priorities for Admin &amp; Editor workflows and manage Storefront Shopping AI daily token limits per account.
          </p>
        </div>
      </div>

      <div className="admin-page-scroll">
        {canManageAiSettings ? (
          <>
            <AiModelSettingsPanel notify={notify} />

            <CustomerAiQuotaSettingsSection notify={notify} />
          </>
        ) : (
          <section className="card ai-settings-card" role="status">
            <div className="ai-settings-card-head">
              <div>
                <h2>Owner Access Required</h2>
                <p className="muted">
                  Only the primary Store Owner can configure AI model priorities and Storefront Shopping AI daily token limits.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
