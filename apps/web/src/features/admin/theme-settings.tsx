"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Palette, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DialogClose } from "@/components/ui/dialog";
import { FormDialog, FormDialogRow, FormDialogSection } from "@/components/ui/form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { ALLOWED_FONTS, themeTokensSchema } from "@/lib/cms-schema";
import { formatDateTime } from "@/lib/format";
import type { AdminThemeResponse, ThemeTokens, ThemeVersionDto } from "@/types/api-cms-ai";

const FONT_ITEMS = ALLOWED_FONTS.map((f) => ({ value: f, label: f }));

const FALLBACK_TOKENS: ThemeTokens = {
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

function ThemeEditorDialog({
  open,
  onOpenChange,
  initialTokens,
  sourceLabel,
  canWrite,
  canPublish,
  notify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTokens: ThemeTokens;
  sourceLabel: string;
  canWrite: boolean;
  canPublish: boolean;
  notify: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tokens, setTokens] = useState<ThemeTokens>(initialTokens);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const saveDraftMutation = useMutation({
    mutationFn: (payload: { next: ThemeTokens; note?: string }) =>
      cmsAdminApi.createThemeVersion(payload.next, payload.note),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      notify(`Saved theme draft v${created.versionNumber}`);
      onOpenChange(false);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to save theme draft"),
  });

  const saveAndPublishMutation = useMutation({
    mutationFn: async (payload: { next: ThemeTokens; note?: string }) => {
      const created = await cmsAdminApi.createThemeVersion(payload.next, payload.note);
      return cmsAdminApi.publishTheme(created.id);
    },
    onSuccess: (pub) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      notify(`Published theme v${pub.versionNumber}`);
      onOpenChange(false);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Failed to publish theme"),
  });

  function updateColor(key: keyof ThemeTokens["colors"], value: string) {
    setTokens((curr) => ({
      ...curr,
      colors: { ...curr.colors, [key]: value.toUpperCase() },
    }));
  }

  function validateTokens(): boolean {
    setError("");
    const check = themeTokensSchema.safeParse(tokens);
    if (!check.success) {
      setError(
        check.error.issues[0]?.message || "Theme tokens failed schema validation."
      );
      return false;
    }
    return true;
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Customize Theme Tokens"
      description={`Editing based on ${sourceLabel}. Changes remain safe until saved or published.`}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        if (!canWrite || !validateTokens()) return;
        saveDraftMutation.mutate({
          next: tokens,
          note: note.trim() || undefined,
        });
      }}
      footer={
        <>
          <DialogClose render={<Button type="button">Cancel</Button>} />
          {canWrite ? (
            <Button
              type="submit"
              variant={canPublish ? "default" : "primary"}
              disabled={saveDraftMutation.isPending || saveAndPublishMutation.isPending}
            >
              <Sparkles size={14} /> Save draft
            </Button>
          ) : null}
          {canPublish ? (
            <Button
              type="button"
              variant="primary"
              disabled={saveDraftMutation.isPending || saveAndPublishMutation.isPending}
              onClick={() => {
                if (!validateTokens()) return;
                saveAndPublishMutation.mutate({
                  next: tokens,
                  note: note.trim() || undefined,
                });
              }}
            >
              <Check size={14} /> Save &amp; Publish
            </Button>
          ) : null}
        </>
      }
    >
      <div className="admin-form-grid">
        <div className="form-stack">
          <FormDialogSection title="Allowlisted color tokens">
            <FormDialogRow>
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
                  <div className="button-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input
                      type="color"
                      aria-label={`${label} color picker`}
                      disabled={!canWrite}
                      value={tokens.colors[key] || "#000000"}
                      onChange={(e) => updateColor(key, e.target.value)}
                      style={{ width: 40, padding: 2, flexShrink: 0 }}
                    />
                    <input
                      disabled={!canWrite}
                      value={tokens.colors[key] || ""}
                      onChange={(e) => updateColor(key, e.target.value)}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                </label>
              ))}
            </FormDialogRow>
          </FormDialogSection>

          <FormDialogSection title="Typography & geometry">
            <FormDialogRow>
              <label>
                Heading font
                <Select
                  disabled={!canWrite}
                  items={FONT_ITEMS}
                  value={tokens.typography.headingFont}
                  onValueChange={(next) =>
                    next &&
                    setTokens((curr) => ({
                      ...curr,
                      typography: {
                        ...curr.typography,
                        headingFont: next,
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                Body font
                <Select
                  disabled={!canWrite}
                  items={FONT_ITEMS}
                  value={tokens.typography.bodyFont}
                  onValueChange={(next) =>
                    next &&
                    setTokens((curr) => ({
                      ...curr,
                      typography: { ...curr.typography, bodyFont: next },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                Card radius
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
                Button radius
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
            </FormDialogRow>

            <label>
              Version note
              <input
                disabled={!canWrite}
                value={note}
                placeholder="Seasonal palette update"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </FormDialogSection>
        </div>

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
    </FormDialog>
  );
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
  const [editorState, setEditorState] = useState<{
    key: string;
    tokens: ThemeTokens;
    label: string;
  } | null>(null);

  const publishMutation = useMutation({
    mutationFn: (versionId?: string) => cmsAdminApi.publishTheme(versionId),
    onSuccess: (pub) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      notify(`Published theme v${pub.versionNumber}`);
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to publish theme"),
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => cmsAdminApi.rollbackTheme(versionId),
    onSuccess: (rolled) => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      notify(`Rolled back theme (created published v${rolled.versionNumber})`);
    },
    onError: (err) =>
      notify(err instanceof ApiError ? err.message : "Failed to rollback theme"),
  });

  const baseTokens =
    data.latest?.tokens || data.published?.tokens || FALLBACK_TOKENS;

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
      id: "primary",
      header: "Primary",
      cell: (ver) => (
        <span className="inline-label">
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: ver.tokens.colors.primary,
              border: "1px solid var(--border)",
            }}
          />
          <code>{ver.tokens.colors.primary}</code>
        </span>
      ),
    },
    {
      id: "typography",
      header: "Typography",
      cell: (ver) =>
        `${ver.tokens.typography.headingFont} / ${ver.tokens.typography.bodyFont}`,
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
              onClick={() =>
                setEditorState({
                  key: ver.id,
                  tokens: ver.tokens,
                  label: `v${ver.versionNumber}`,
                })
              }
            >
              Edit copy
            </Button>
          ) : null}
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
      ),
    },
  ];

  return (
    <>
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
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate(data.latest?.id)}
            >
              <Check size={14} /> Publish v{data.latest.versionNumber}
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              variant="primary"
              onClick={() =>
                setEditorState({
                  key: data.latest?.id || "new",
                  tokens: baseTokens,
                  label: data.latest
                    ? `v${data.latest.versionNumber}`
                    : "default palette",
                })
              }
            >
              <Palette size={15} /> Customize theme
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable
        title="Theme version history"
        columns={columns}
        data={data.versions}
        getRowKey={(ver) => ver.id}
        pageSize={10}
      />

      {editorState ? (
        <ThemeEditorDialog
          key={editorState.key}
          open
          onOpenChange={(nextOpen) => !nextOpen && setEditorState(null)}
          initialTokens={editorState.tokens}
          sourceLabel={editorState.label}
          canWrite={canWrite}
          canPublish={canPublish}
          notify={notify}
        />
      ) : null}
    </>
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
