"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Palette, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { ALLOWED_FONTS, themeTokensSchema } from "@/lib/cms-schema";
import { formatDateTime } from "@/lib/format";
import type { AdminThemeResponse, ThemeTokens, ThemeVersionDto } from "@/types/api-cms-ai";

function ThemeEditorForm({
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
  const baseTokens: ThemeTokens = data.latest?.tokens ||
    data.published?.tokens || {
      version: 1,
      colors: {
        primary: "#5B46E8",
        background: "#FFFFFF",
        surface: "#F8FAFC",
        text: "#111318",
        muted: "#5C6270",
        accent: "#18794E",
      },
      typography: { headingFont: "Georgia", bodyFont: "Inter" },
      radius: { card: "10px", button: "8px" },
      container: { maxWidth: "1280px" },
    };

  const [tokens, setTokens] = useState<ThemeTokens>(baseTokens);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const saveDraftMutation = useMutation({
    mutationFn: (payload: { next: ThemeTokens; note?: string }) =>
      cmsAdminApi.createThemeVersion(payload.next, payload.note),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      setNote("");
      notify(`Saved theme draft v${created.versionNumber}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to save theme draft"),
  });

  const publishMutation = useMutation({
    mutationFn: (versionId?: string) => cmsAdminApi.publishTheme(versionId),
    onSuccess: (pub) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      notify(`Published theme v${pub.versionNumber}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to publish theme"),
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => cmsAdminApi.rollbackTheme(versionId),
    onSuccess: (rolled) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      setTokens(rolled.tokens);
      notify(`Rolled back theme (created published v${rolled.versionNumber})`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to rollback theme"),
  });

  function updateColor(key: keyof ThemeTokens["colors"], value: string) {
    setTokens((curr) => ({
      ...curr,
      colors: { ...curr.colors, [key]: value.toUpperCase() },
    }));
  }

  return (
    <div className="form-stack">
      <div className="admin-title">
        <div>
          <h1>Theme Tokens</h1>
          <p>
            Allowlisted storefront colors, typography, radii, and container spacing (no raw CSS injection).
          </p>
        </div>
        <div className="button-row">
          {data.published ? (
            <Badge tone="green">Published v{data.published.versionNumber}</Badge>
          ) : null}
          {canPublish && data.latest && data.latest.status !== "PUBLISHED" ? (
            <Button
              variant="primary"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate(data.latest?.id)}
            >
              <Check size={14} /> Publish v{data.latest.versionNumber}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="detail-grid">
        <form
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const check = themeTokensSchema.safeParse(tokens);
            if (!check.success) {
              setError(
                check.error.issues[0]?.message ||
                  "Theme tokens failed schema validation."
              );
              return;
            }
            saveDraftMutation.mutate({
              next: tokens,
              note: note.trim() || undefined,
            });
          }}
        >
          <h2>Allowlisted color tokens</h2>
          <div className="field-row">
            {(
              [
                ["primary", "Primary"],
                ["background", "Background"],
                ["surface", "Surface"],
                ["text", "Text"],
                ["muted", "Muted"],
                ["accent", "Accent"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <div className="button-row" style={{ gap: 6 }}>
                  <input
                    type="color"
                    aria-label={`${label} color picker`}
                    disabled={!canWrite}
                    value={tokens.colors[key] || "#000000"}
                    onChange={(e) => updateColor(key, e.target.value)}
                    style={{ width: 40, padding: 2 }}
                  />
                  <input
                    disabled={!canWrite}
                    value={tokens.colors[key] || ""}
                    onChange={(e) => updateColor(key, e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              </label>
            ))}
          </div>

          <h2>Typography & geometry</h2>
          <div className="field-row">
            <label>
              Heading font
              <select
                disabled={!canWrite}
                value={tokens.typography.headingFont}
                onChange={(e) =>
                  setTokens((curr) => ({
                    ...curr,
                    typography: {
                      ...curr.typography,
                      headingFont: e.target.value,
                    },
                  }))
                }
              >
                {ALLOWED_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Body font
              <select
                disabled={!canWrite}
                value={tokens.typography.bodyFont}
                onChange={(e) =>
                  setTokens((curr) => ({
                    ...curr,
                    typography: { ...curr.typography, bodyFont: e.target.value },
                  }))
                }
              >
                {ALLOWED_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-row">
            <label>
              Card radius (0px–24px)
              <input
                disabled={!canWrite}
                value={tokens.radius.card}
                onChange={(e) =>
                  setTokens((curr) => ({
                    ...curr,
                    radius: { ...curr.radius, card: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              Button radius (0px–999px)
              <input
                disabled={!canWrite}
                value={tokens.radius.button}
                onChange={(e) =>
                  setTokens((curr) => ({
                    ...curr,
                    radius: { ...curr.radius, button: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              Container maxWidth (1024px–1536px)
              <input
                disabled={!canWrite}
                value={tokens.container.maxWidth}
                onChange={(e) =>
                  setTokens((curr) => ({
                    ...curr,
                    container: { maxWidth: e.target.value },
                  }))
                }
              />
            </label>
          </div>

          <label>
            Version note
            <input
              disabled={!canWrite}
              value={note}
              placeholder="Seasonal palette update"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          {error ? (
            <p className="danger" role="alert">
              {error}
            </p>
          ) : null}

          {canWrite ? (
            <div className="button-row">
              <Button
                variant="primary"
                type="submit"
                disabled={saveDraftMutation.isPending}
              >
                <Sparkles size={14} /> Save draft version
              </Button>
            </div>
          ) : null}
        </form>

        <aside className="form-stack">
          <section
            className="panel form-stack"
            style={{
              background: tokens.colors.background,
              color: tokens.colors.text,
              borderRadius: tokens.radius.card,
            }}
          >
            <strong
              style={{
                fontFamily: tokens.typography.headingFont,
                fontSize: 20,
              }}
            >
              Live Token Preview
            </strong>
            <p
              style={{
                fontFamily: tokens.typography.bodyFont,
                color: tokens.colors.muted,
                fontSize: 13,
              }}
            >
              Storefront cards and call-to-action buttons reflect published tokens.
            </p>
            <div
              style={{
                padding: 12,
                background: tokens.colors.surface,
                borderRadius: tokens.radius.card,
              }}
            >
              <button
                type="button"
                className="btn"
                style={{
                  background: tokens.colors.primary,
                  color: "#FFFFFF",
                  borderColor: tokens.colors.primary,
                  borderRadius: tokens.radius.button,
                }}
              >
                Primary CTA
              </button>
            </div>
          </section>
        </aside>
      </div>

      <section className="admin-table-panel">
        <h2>Theme version history</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Primary</th>
                <th>Note</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.versions.map((ver: ThemeVersionDto) => (
                <tr key={ver.id}>
                  <td>
                    <strong>v{ver.versionNumber}</strong>
                  </td>
                  <td>
                    <StatusBadge status={ver.status} />
                  </td>
                  <td>
                    <code>{ver.tokens.colors.primary}</code>
                  </td>
                  <td className="muted">{ver.note || "—"}</td>
                  <td>{formatDateTime(ver.createdAt)}</td>
                  <td>
                    <div className="button-row">
                      {canPublish && ver.status === "DRAFT" ? (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={publishMutation.isPending}
                          onClick={() => publishMutation.mutate(ver.id)}
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
                          <RotateCcw size={13} /> Rollback
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
    <ThemeEditorForm
      key={themeQuery.data.latest?.id || "theme"}
      data={themeQuery.data}
      canWrite={canWrite}
      canPublish={canPublish}
      notify={notify}
    />
  );
}
