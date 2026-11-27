"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Columns3,
  ExternalLink,
  Eye,
  History,
  Laptop,
  Maximize2,
  Plus,
  Redo2,
  Rocket,
  Save,
  Settings,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "@/features/builder/store/editor-store";
import type { ViewportMode } from "@/features/builder/types";
import { cn, formatDate } from "@/lib/format";
import type { PageDetailDto, PageSummaryDto } from "@/types/api-cms-ai";

export function EditorTopBar({
  pages,
  activePageDetail,
  canWrite,
  canPublish,
  savingDraft,
  publishing,
  creatingPage,
  rollingBack,
  onSelectPage,
  onCreatePage,
  onSaveDraft,
  onPublish,
  onRollbackVersion,
}: {
  pages: PageSummaryDto[];
  activePageDetail?: PageDetailDto;
  canWrite: boolean;
  canPublish: boolean;
  savingDraft: boolean;
  publishing: boolean;
  creatingPage: boolean;
  rollingBack: boolean;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (body: { slug: string; title: string }) => Promise<void>;
  onSaveDraft: () => void;
  onPublish: () => void;
  onRollbackVersion: (versionId: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);

  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [metaTitleDraft, setMetaTitleDraft] = useState("");
  const [metaSeoTitleDraft, setMetaSeoTitleDraft] = useState("");
  const [metaSeoDescDraft, setMetaSeoDescDraft] = useState("");

  const pageId = useEditorStore((s) => s.pageId);
  const pageSlug = useEditorStore((s) => s.pageSlug);
  const pageTitle = useEditorStore((s) => s.pageTitle);
  const status = useEditorStore((s) => s.status);
  const dirty = useEditorStore((s) => s.dirty);
  const themeDirty = useEditorStore((s) => s.themeDirty);
  const hasUnsaved = dirty || themeDirty;
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const viewport = useEditorStore((s) => s.viewport);
  const zoom = useEditorStore((s) => s.zoom);
  const showOutlines = useEditorStore((s) => s.showOutlines);
  const showGrid = useEditorStore((s) => s.showGrid);
  const previewMode = useEditorStore((s) => s.previewMode);
  const aiBarOpen = useEditorStore((s) => s.aiBarOpen);
  const history = useEditorStore((s) => s.history);
  const historyIndex = useEditorStore((s) => s.historyIndex);

  const setViewport = useEditorStore((s) => s.setViewport);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setShowOutlines = useEditorStore((s) => s.setShowOutlines);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const toggleAiBar = useEditorStore((s) => s.toggleAiBar);
  const setPageMeta = useEditorStore((s) => s.setPageMeta);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const pageItems = pages.map((p) => ({
    value: p.id,
    label: `${p.title} (/${p.slug})`,
  }));

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;
  const liveHref =
    pageSlug === "home" ? "/" : `/store/${encodeURIComponent(pageSlug)}`;

  return (
    <header className="ed-topbar">
      <div className="ed-topbar-left">
        <Link href="/admin/pages" className="ed-back-link">
          <ArrowLeft size={14} />
          <span>Admin</span>
        </Link>

        <div className="ed-page-switcher">
          {pageItems.length ? (
            <Select
              items={pageItems}
              value={pageId || pageItems[0].value}
              onValueChange={(next) => {
                if (next) onSelectPage(next);
              }}
            >
              <SelectTrigger aria-label="Select CMS page" size="sm" className="ed-page-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <strong style={{ fontSize: 13 }}>{pageTitle}</strong>
          )}

          {canWrite ? (
            <IconButton
              label="Create new page"
              title="New page"
              onClick={() => {
                setNewSlug("");
                setNewTitle("");
                setNewPageOpen(true);
              }}
            >
              <Plus size={14} />
            </IconButton>
          ) : null}
        </div>

        <div className="ed-status-cluster">
          <Badge tone={hasUnsaved ? "accent" : "green"}>
            {!hasUnsaved && !savingDraft ? <CheckCircle2 size={11} /> : null}
            <span>
              {savingDraft || saveStatus === "saving"
                ? "Saving"
                : hasUnsaved || saveStatus === "unsaved"
                  ? "Unsaved"
                  : "Saved"}
            </span>
          </Badge>
          <Badge tone={status === "PUBLISHED" ? "green" : "neutral"}>
            {status === "PUBLISHED" ? "Live" : "Draft"}
          </Badge>
        </div>
      </div>

      <div className="ed-topbar-center">
        <div className="ed-btn-group">
          <IconButton
            label="Undo"
            title={
              canUndo
                ? `Undo: ${history[historyIndex]?.summary || "last change"}`
                : "Nothing to undo"
            }
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 size={14} />
          </IconButton>
          <IconButton
            label="Redo"
            title={
              canRedo
                ? `Redo: ${history[historyIndex + 1]?.summary || "next change"}`
                : "Nothing to redo"
            }
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 size={14} />
          </IconButton>
        </div>

        <div className="ed-viewport-seg" role="group" aria-label="Device viewport">
          {(
            [
              ["desktop", Laptop, "Desktop"],
              ["tablet", Tablet, "Tablet"],
              ["mobile", Smartphone, "Mobile"],
            ] as const satisfies ReadonlyArray<readonly [ViewportMode, typeof Laptop, string]>
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={`${label} viewport`}
              aria-pressed={viewport === key}
              className={cn("ed-seg-btn", viewport === key && "active")}
              onClick={() => setViewport(key)}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <div className="ed-btn-group ed-zoom-group">
          <IconButton
            label="Zoom out"
            onClick={() => setZoom(Math.round((zoom - 0.1) * 10) / 10)}
            disabled={zoom <= 0.6}
          >
            <ZoomOut size={13} />
          </IconButton>
          <button
            type="button"
            className="ed-zoom-readout"
            title="Reset zoom to 100%"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            label="Zoom in"
            onClick={() => setZoom(Math.round((zoom + 0.1) * 10) / 10)}
            disabled={zoom >= 1.4}
          >
            <ZoomIn size={13} />
          </IconButton>
          <IconButton
            label="Fit screen"
            title="Fit viewport"
            onClick={() => setZoom(viewport === "desktop" ? 0.9 : 1)}
          >
            <Maximize2 size={13} />
          </IconButton>
        </div>

        <div className="ed-btn-group">
          <IconButton
            label="Toggle element outlines"
            title="Toggle element outlines"
            className={showOutlines ? "ed-tool-active" : undefined}
            onClick={() => setShowOutlines(!showOutlines)}
          >
            <Box size={14} />
          </IconButton>
          <IconButton
            label="Toggle grid guides"
            title="Toggle 12-column grid guides"
            className={showGrid ? "ed-tool-active" : undefined}
            onClick={() => setShowGrid(!showGrid)}
          >
            <Columns3 size={14} />
          </IconButton>
        </div>
      </div>

      <div className="ed-topbar-right">
        <IconButton
          label={aiBarOpen ? "Hide AI chat" : "Show AI chat"}
          title={aiBarOpen ? "Hide AI chat" : "Show AI chat"}
          className={aiBarOpen ? "ed-tool-active" : undefined}
          onClick={toggleAiBar}
        >
          <Sparkles size={14} />
        </IconButton>
        <IconButton
          label={previewMode ? "Exit Preview" : "Preview"}
          title={previewMode ? "Exit Preview" : "Live Preview"}
          className={previewMode ? "ed-tool-active" : undefined}
          onClick={() => setPreviewMode(!previewMode)}
        >
          <Eye size={14} />
        </IconButton>
        <IconButton
          label="Page settings"
          title="Page settings & SEO"
          onClick={() => {
            const state = useEditorStore.getState();
            setMetaTitleDraft(state.pageTitle);
            setMetaSeoTitleDraft(state.seoTitle);
            setMetaSeoDescDraft(state.seoDescription);
            setSettingsOpen(true);
          }}
        >
          <Settings size={14} />
        </IconButton>
        <IconButton
          label="Version history"
          title="Version history & rollback"
          onClick={() => setVersionsOpen(true)}
        >
          <History size={14} />
        </IconButton>

        <Link
          href={liveHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm ed-icon-text-btn"
          title="Open live published storefront"
        >
          <ExternalLink size={13} />
          <span>Store</span>
        </Link>

        <Button
          size="sm"
          disabled={!canWrite || savingDraft}
          onClick={onSaveDraft}
          className="ed-save-btn"
          title="Save Draft (Ctrl+S)"
        >
          <Save size={13} />
          <span>{savingDraft ? "Saving..." : "Save Draft"}</span>
        </Button>

        {canPublish ? (
          <Button
            size="sm"
            variant="primary"
            disabled={publishing || savingDraft}
            onClick={onPublish}
            className="ed-publish-btn"
          >
            <Rocket size={13} />
            <span>{publishing ? "Publishing..." : "Publish"}</span>
          </Button>
        ) : null}
      </div>

      <FormDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Page Settings"
        description={`Editing metadata for /${pageSlug}`}
        submitLabel="Apply metadata"
        onSubmit={(e) => {
          e.preventDefault();
          setPageMeta({
            pageTitle: metaTitleDraft,
            seoTitle: metaSeoTitleDraft,
            seoDescription: metaSeoDescDraft,
          });
          setSettingsOpen(false);
        }}
      >
        <div className="ed-dialog-fields">
          <label>
            <span>Page Title</span>
            <input
              type="text"
              required
              value={metaTitleDraft}
              onChange={(e) => setMetaTitleDraft(e.target.value)}
            />
          </label>
          <label>
            <span>SEO Meta Title</span>
            <input
              type="text"
              value={metaSeoTitleDraft}
              onChange={(e) => setMetaSeoTitleDraft(e.target.value)}
            />
          </label>
          <label>
            <span>SEO Meta Description</span>
            <textarea
              rows={3}
              value={metaSeoDescDraft}
              onChange={(e) => setMetaSeoDescDraft(e.target.value)}
            />
          </label>
        </div>
      </FormDialog>

      <FormDialog
        open={newPageOpen}
        onOpenChange={setNewPageOpen}
        title="Create New Page"
        description="Creates an empty CMS page ready for visual editing."
        submitLabel={creatingPage ? "Creating..." : "Create Page"}
        isSubmitting={creatingPage}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newSlug.trim() || !newTitle.trim()) return;
          await onCreatePage({
            slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
            title: newTitle.trim(),
          });
          setNewPageOpen(false);
        }}
      >
        <div className="ed-dialog-fields">
          <label>
            <span>Page Title</span>
            <input
              type="text"
              required
              placeholder="Autumn Expedition Lookbook"
              value={newTitle}
              onChange={(e) => {
                const t = e.target.value;
                setNewTitle(t);
                if (!newSlug) {
                  setNewSlug(
                    t
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                  );
                }
              }}
            />
          </label>
          <label>
            <span>URL Slug</span>
            <input
              type="text"
              required
              pattern="^[a-z0-9-]+$"
              placeholder="autumn-lookbook"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
            />
          </label>
        </div>
      </FormDialog>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Saved Revisions &amp; Rollback</DialogTitle>
            <DialogDescription>
              Version history for {pageTitle}. Rolling back creates a fresh published revision from any historical snapshot.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="ed-version-list">
              {(activePageDetail?.versions || []).map((ver) => {
                const isPublished = activePageDetail?.publishedVersionId === ver.id;
                return (
                  <div key={ver.id} className="ed-version-row">
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong>v{ver.versionNumber}</strong>
                        {isPublished ? <Badge tone="green">Live</Badge> : null}
                      </div>
                      <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                        {ver.changeSummary || "Draft saved"} · {formatDate(ver.createdAt)}
                      </p>
                    </div>
                    {canPublish ? (
                      <Button
                        size="sm"
                        disabled={rollingBack}
                        onClick={() => {
                          onRollbackVersion(ver.id);
                          setVersionsOpen(false);
                        }}
                      >
                        Restore v{ver.versionNumber}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </header>
  );
}
