"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUpRight,
  Box,
  ChevronRight,
  CircleHelp,
  Cloud,
  Command as CommandIcon,
  Eye,
  History,
  Layers,
  LayoutDashboard,
  Moon,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { CommandPalette, type CommandItem } from "@/components/ui/command-palette";
import { Skeleton } from "@/components/ui/data-display";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { aiAdminApi, cmsAdminApi } from "@/lib/cms-ai-api";
import {
  apiBlocksToEditorBlocks,
  editorBlocksToApiBlocks,
  themeTokensToCssVars,
} from "@/lib/cms-schema";
import { storeApi } from "@/lib/commerce-api";
import { cn, formatDateTime, newId } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";
import { blockKinds, blockMeta, makeBlock } from "@/mocks/pages";
import type { AIModelId } from "@/types/ai";
import type { AiChangePlanDto, PageContentPayload } from "@/types/api-cms-ai";
import type {
  Block,
  EditorMessage,
  Proposal,
  ViewportMode,
} from "@/types/editor";
import { EditorCanvas } from "./canvas";
import { InspectorPanel } from "./inspector-panel";
import { SectionIcon, StructurePanel } from "./structure-panel";

function planToEditorProposal(
  plan: AiChangePlanDto,
  currentBlocks: Block[],
  selectedBlockId?: string
): Proposal | null {
  if (plan.planType !== "PAGE_CHANGE") return null;
  const content = plan.operations?.content as PageContentPayload | undefined;
  if (!content || !Array.isArray(content.blocks)) return null;

  const after = apiBlocksToEditorBlocks(content);
  const currentIds = new Set(currentBlocks.map((b) => b.id));
  const added = after.find((b) => !currentIds.has(b.id));
  const changed = after.find((b) => {
    const prev = currentBlocks.find((c) => c.id === b.id);
    return !prev || JSON.stringify(prev) !== JSON.stringify(b);
  });

  const target =
    added?.id || changed?.id || selectedBlockId || after[0]?.id || "";
  const diffs = (plan.preview || []).map((row) => ({
    field: row.name,
    before: row.before,
    after: row.after,
  }));
  const changes = diffs.length
    ? diffs.map((d) => `${d.field}: ${d.before} → ${d.after}`)
    : [plan.requestSummary || "Update page draft"];

  return {
    before: currentBlocks,
    after,
    title: plan.requestSummary || "AI Page Proposal",
    changes,
    diffs,
    target,
  };
}

export function Editor() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const canPublish = hasPermission("content:publish");
  const canUseAi = hasPermission("ai:use");

  const [theme, setTheme] = useAppTheme();
  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    if (typeof window === "undefined") return "home";
    return new URLSearchParams(window.location.search).get("page") || "home";
  });

  const [workingState, setWorkingState] = useState<{
    pageId: string;
    version: number;
    blocks: Block[];
  } | null>(null);
  const [past, setPast] = useState<Block[][]>([]);
  const [future, setFuture] = useState<Block[][]>([]);
  const [selection, setSelection] = useState("");
  const [mode, setMode] = useState<ViewportMode>("desktop");
  const [tab, setTab] = useState<"ai" | "properties">("ai");
  const [panel, setPanel] = useState<"structure" | "inspector" | null>(null);
  const [preview, setPreview] = useState<"page" | "proposal" | null>(null);
  const [dialog, setDialog] = useState<
    | "library"
    | "publish"
    | "discard"
    | "command"
    | "delete"
    | "switch"
    | "history"
    | null
  >(null);
  const [nextPageSlug, setNextPageSlug] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [toast, setToast] = useState("");

  const [model, setModel] = useState<AIModelId>("claude-sonnet-4");
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EditorMessage[]>([]);
  const [pendingPlan, setPendingPlan] = useState<AiChangePlanDto | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const unmountedRef = useRef(false);

  const pagesQuery = useQuery({
    queryKey: ["admin-pages"],
    queryFn: () => cmsAdminApi.listPages(),
  });

  const pagesList = useMemo(() => pagesQuery.data || [], [pagesQuery.data]);
  const pageSlugs = useMemo(
    () => (pagesList.length ? pagesList.map((p) => p.slug) : ["home"]),
    [pagesList]
  );

  const currentSummary = useMemo(() => {
    if (!pagesList.length) return undefined;
    return (
      pagesList.find(
        (p) => p.slug === selectedSlug || p.title === selectedSlug
      ) ||
      pagesList.find((p) => p.slug === "home") ||
      pagesList[0]
    );
  }, [pagesList, selectedSlug]);

  const pageDetailQuery = useQuery({
    queryKey: ["admin-page", currentSummary?.id],
    queryFn: () => cmsAdminApi.getPage(currentSummary!.id),
    enabled: Boolean(currentSummary?.id),
  });

  const themeQuery = useQuery({
    queryKey: ["admin-theme"],
    queryFn: () => cmsAdminApi.getTheme(),
  });

  const catalogQuery = useQuery({
    queryKey: ["editor-catalog"],
    queryFn: () => storeApi.listProducts({ size: 24 }),
  });

  const detail = pageDetailQuery.data;
  const activeTokens =
    themeQuery.data?.latest?.tokens || themeQuery.data?.published?.tokens;
  const themeStyle = useMemo(
    () => themeTokensToCssVars(activeTokens),
    [activeTokens]
  );

  const storedBlocks = useMemo(
    () =>
      apiBlocksToEditorBlocks(
        detail?.latestVersion?.content || detail?.publishedVersion?.content
      ),
    [detail?.latestVersion?.content, detail?.publishedVersion?.content]
  );

  const liveBlocks = useMemo(
    () => apiBlocksToEditorBlocks(detail?.publishedVersion?.content),
    [detail?.publishedVersion?.content]
  );

  const activeWorking =
    detail &&
    workingState?.pageId === detail.id &&
    workingState.version === detail.version
      ? workingState.blocks
      : null;

  const blocks = activeWorking ?? storedBlocks;
  const dirty =
    activeWorking !== null &&
    JSON.stringify(activeWorking) !== JSON.stringify(storedBlocks);
  const isPublished =
    Boolean(detail?.publishedVersionId) &&
    !dirty &&
    JSON.stringify(blocks) === JSON.stringify(liveBlocks);

  const selectedBlock =
    blocks.find((item) => item.id === selection) || blocks[0];

  const showBlocks =
    preview === "proposal" && proposal ? proposal.after : blocks;

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const clock = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(clock);
  }, [toast]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const saveDraftMutation = useMutation({
    mutationFn: async (nextBlocks: Block[]) => {
      if (!detail) throw new Error("Page is still loading");
      return cmsAdminApi.createPageVersion(detail.id, {
        content: editorBlocksToApiBlocks(nextBlocks),
        expectedVersion: detail.version,
        changeSummary: "Updated in Visual Store Editor",
      });
    },
    onSuccess: (updated) => {
      setWorkingState(null);
      setPast([]);
      setFuture([]);
      queryClient.setQueryData(["admin-page", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      setToast(`Saved draft v${updated.latestVersionNumber}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409 && detail) {
        queryClient.invalidateQueries({ queryKey: ["admin-page", detail.id] });
        setToast("Version conflict — reloaded latest draft");
        return;
      }
      setToast(err instanceof ApiError ? err.message : "Failed to save draft");
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("Page is still loading");
      let versionToPublish = detail.latestVersion?.id;
      let expectedVersion = detail.version;
      if (dirty) {
        const saved = await cmsAdminApi.createPageVersion(detail.id, {
          content: editorBlocksToApiBlocks(blocks),
          expectedVersion: detail.version,
          changeSummary: "Saved before publish in Visual Store Editor",
        });
        versionToPublish = saved.latestVersion?.id;
        expectedVersion = saved.version;
      }
      return cmsAdminApi.publishPage(detail.id, {
        versionId: versionToPublish,
        expectedVersion,
      });
    },
    onSuccess: (updated) => {
      setWorkingState(null);
      setPast([]);
      setFuture([]);
      queryClient.setQueryData(["admin-page", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      queryClient.invalidateQueries({
        queryKey: ["store-page", updated.slug],
      });
      setDialog(null);
      setToast(`Published "${updated.slug}" v${updated.latestVersionNumber}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409 && detail) {
        queryClient.invalidateQueries({ queryKey: ["admin-page", detail.id] });
        setToast("Version conflict — please review latest draft");
        return;
      }
      setToast(err instanceof ApiError ? err.message : "Publish failed");
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!detail) throw new Error("Page is still loading");
      return cmsAdminApi.rollbackPage(detail.id, versionId);
    },
    onSuccess: (updated) => {
      setWorkingState(null);
      setPast([]);
      setFuture([]);
      queryClient.setQueryData(["admin-page", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      queryClient.invalidateQueries({
        queryKey: ["store-page", updated.slug],
      });
      setDialog(null);
      setToast(`Restored version to draft/live v${updated.latestVersionNumber}`);
    },
    onError: (err) =>
      setToast(err instanceof ApiError ? err.message : "Rollback failed"),
  });

  const applyPlanMutation = useMutation({
    mutationFn: async ({
      planId,
      accept,
    }: {
      planId: string;
      accept: boolean;
    }) => {
      if (accept) {
        return aiAdminApi.applyChangePlan(
          planId,
          `editor-${planId}-${Date.now()}`
        );
      }
      return aiAdminApi.rejectChangePlan(
        planId,
        "Rejected from Visual Store Editor"
      );
    },
    onSuccess: (_res, vars) => {
      setMessages((curr) =>
        curr.map((m, idx) =>
          idx === curr.length - 1
            ? { ...m, status: vars.accept ? "accepted" : "rejected" }
            : m
        )
      );
      setPendingPlan(null);
      setProposal(null);
      setPreview(null);
      if (vars.accept && detail) {
        setWorkingState(null);
        setPast([]);
        setFuture([]);
        queryClient.invalidateQueries({ queryKey: ["admin-page", detail.id] });
        queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
        setToast("AI proposal applied to draft (publish when ready)");
      } else {
        setToast("AI proposal rejected");
      }
      queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
    },
    onError: (err) => {
      setToast(
        err instanceof ApiError ? err.message : "Failed to resolve AI plan"
      );
    },
  });

  function commit(next: Block[]) {
    if (!detail || !canWrite) return;
    setPast((p) => [...p, blocks]);
    setWorkingState({ pageId: detail.id, version: detail.version, blocks: next });
    setFuture([]);
    setPreview(null);
  }

  function undo() {
    if (!detail || !past.length) return;
    setFuture((f) => [blocks, ...f]);
    setWorkingState({
      pageId: detail.id,
      version: detail.version,
      blocks: past[past.length - 1],
    });
    setPast((p) => p.slice(0, -1));
    setPreview(null);
  }

  function redo() {
    if (!detail || !future.length) return;
    setPast((p) => [...p, blocks]);
    setWorkingState({
      pageId: detail.id,
      version: detail.version,
      blocks: future[0],
    });
    setFuture((f) => f.slice(1));
    setPreview(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDialog("command");
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "Escape") {
        setPreview(null);
        setPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function switchPage(slug: string) {
    setBusy(false);
    setStatusLine("");
    setSelectedSlug(slug);
    setWorkingState(null);
    setPast([]);
    setFuture([]);
    setSelection("");
    setPendingPlan(null);
    setProposal(null);
    setPreview(null);
    setConvId(null);
    setMessages([]);
    setDialog(null);
    setPanel(null);
  }

  function updateSelected(change: Partial<Block>) {
    if (!selectedBlock) return;
    commit(
      blocks.map((item) =>
        item.id === selectedBlock.id ? { ...item, ...change } : item
      )
    );
  }

  function moveSelected(offset: number) {
    if (!selectedBlock) return;
    const index = blocks.findIndex((item) => item.id === selectedBlock.id);
    const next = [...blocks];
    if (index < 0 || !next[index + offset]) return;
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    commit(next);
  }

  function reorderBlocks(fromIndex: number, toIndex: number) {
    const next = [...blocks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commit(next);
  }

  function duplicateSelected() {
    if (!selectedBlock) return;
    const clone: Block = {
      ...selectedBlock,
      id: newId(),
      label: selectedBlock.label + " copy",
    };
    const next = [...blocks];
    next.splice(blocks.indexOf(selectedBlock) + 1, 0, clone);
    commit(next);
    setSelection(clone.id);
  }

  async function send(prompt: string) {
    if (!detail || !canUseAi || busy) return;
    const msgId = newId();
    setPendingPlan(null);
    setProposal(null);
    setPreview(null);
    setBusy(true);
    setStatusLine("Connecting to 9Router AI gateway…");
    setMessages((curr) => [...curr, { id: msgId, prompt }]);

    try {
      let activeConvId = convId;
      if (!activeConvId) {
        const created = await aiAdminApi.createConversation(
          `Editor: ${detail.title}`,
          model
        );
        activeConvId = created.id;
        if (!unmountedRef.current) {
          setConvId(created.id);
        }
      }

      let latestPlan: AiChangePlanDto | null = null;
      let streamedText = "";

      await aiAdminApi.streamMessage(
        activeConvId,
        {
          prompt,
          model,
          context: {
            pageId: detail.id,
            pageSlug: detail.slug,
            selectedBlockId: selectedBlock?.id,
            selectedBlockType: selectedBlock?.type,
          },
        },
        {
          onStatus: (s) => {
            if (!unmountedRef.current) {
              setStatusLine(s.message || s.phase);
            }
          },
          onToolStarted: (t) => {
            if (!unmountedRef.current) {
              setStatusLine(`Running tool: ${t.tool}…`);
            }
          },
          onToolCompleted: () => {
            if (!unmountedRef.current) {
              setStatusLine("Drafting section update…");
            }
          },
          onPlanCreated: (plan) => {
            latestPlan = plan;
            if (!unmountedRef.current && plan.status === "PENDING_APPROVAL") {
              setPendingPlan(plan);
              const mapped = planToEditorProposal(
                plan,
                blocks,
                selectedBlock?.id
              );
              if (mapped) {
                setProposal(mapped);
              }
            }
          },
          onMessageDelta: (delta) => {
            streamedText += delta.text || "";
          },
          onCompleted: (result) => {
            if (unmountedRef.current) return;
            const replyText =
              result.assistantMessage?.content ||
              streamedText ||
              "Completed response.";
            const plan =
              result.changePlans?.find(
                (p) => p.status === "PENDING_APPROVAL"
              ) || latestPlan;
            if (plan && plan.status === "PENDING_APPROVAL") {
              setPendingPlan(plan);
              const mapped = planToEditorProposal(
                plan,
                blocks,
                selectedBlock?.id
              );
              if (mapped) {
                setProposal(mapped);
              }
            }
            setMessages((curr) =>
              curr.map((m) =>
                m.id === msgId ? { ...m, reply: replyText } : m
              )
            );
            queryClient.invalidateQueries({ queryKey: ["ai-activity"] });
            queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
          },
          onError: (errMsg) => {
            if (unmountedRef.current) return;
            setMessages((curr) =>
              curr.map((m) =>
                m.id === msgId
                  ? { ...m, reply: errMsg, status: "error" }
                  : m
              )
            );
          },
        }
      );
    } catch (err) {
      if (!unmountedRef.current) {
        const message =
          err instanceof ApiError ? err.message : "Failed to run AI request";
        setMessages((curr) =>
          curr.map((m) =>
            m.id === msgId ? { ...m, reply: message, status: "error" } : m
          )
        );
      }
    } finally {
      if (!unmountedRef.current) {
        setBusy(false);
        setStatusLine("");
      }
    }
  }

  function resolveProposal(accept: boolean) {
    if (!pendingPlan) return;
    applyPlanMutation.mutate({ planId: pendingPlan.id, accept });
  }

  const commands: CommandItem[] = [
    ...(canWrite
      ? [
          {
            id: "cmd-add",
            label: "Add section to page",
            group: "Editor",
            run: () => {
              setLibraryQuery("");
              setDialog("library");
            },
          },
          {
            id: "cmd-save",
            label: "Save draft",
            group: "Publishing",
            run: () => {
              if (dirty) {
                saveDraftMutation.mutate(blocks);
              } else {
                setToast("No unsaved changes");
              }
            },
          },
          {
            id: "cmd-discard",
            label: "Discard unsaved changes",
            group: "Publishing",
            run: () => setDialog("discard"),
          },
        ]
      : []),
    {
      id: "cmd-preview",
      label: "Toggle clean storefront preview",
      group: "Publishing",
      run: () => setPreview(preview === "page" ? null : "page"),
    },
    ...(canPublish
      ? [
          {
            id: "cmd-publish",
            label: "Publish changes live",
            group: "Publishing",
            run: () => setDialog("publish"),
          },
        ]
      : []),
    {
      id: "cmd-history",
      label: "Open page version history",
      group: "Publishing",
      icon: <History size={14} />,
      run: () => setDialog("history"),
    },
    {
      id: "cmd-theme",
      label:
        theme === "light" ? "Switch to dark theme" : "Switch to light theme",
      group: "Preferences",
      icon: theme === "light" ? <Moon size={14} /> : <Sun size={14} />,
      run: () => setTheme(theme === "light" ? "dark" : "light"),
    },
    {
      id: "cmd-admin",
      label: "Go to Merchant Admin Dashboard",
      group: "Navigation",
      icon: <LayoutDashboard size={14} />,
      run: () => router.push("/admin"),
    },
    {
      id: "cmd-store",
      label: "Open Storefront",
      group: "Navigation",
      icon: <ArrowUpRight size={14} />,
      run: () =>
        router.push(
          detail?.slug === "home" || !detail?.slug
            ? "/store"
            : `/store/${encodeURIComponent(detail.slug)}`
        ),
    },
  ];

  const categoriesOrder = [
    "Hero & Editorial",
    "Commerce",
    "Social & Trust",
    "Utility",
  ] as const;

  if (pagesQuery.isLoading || (currentSummary && pageDetailQuery.isLoading)) {
    return (
      <div className="editor-app" style={{ padding: 24 }}>
        <Skeleton rows={6} />
      </div>
    );
  }

  return (
    <div
      className="editor-app"
      onClickCapture={(event) => {
        if (
          !dirty ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor = (event.target as HTMLElement).closest?.("a");
        if (
          anchor &&
          anchor.target !== "_blank" &&
          anchor.origin === window.location.origin &&
          !window.confirm("Leave the Visual Editor and discard unsaved changes?")
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <header className="editor-top">
        <Link className="forma-mark" href="/admin" aria-label="Admin dashboard">
          <Box size={20} strokeWidth={2.1} />
        </Link>

        <div className="editor-breadcrumb">
          <Link href="/admin">Dat Commerce</Link>
          <ChevronRight size={14} />
          <strong>Visual Store Editor</strong>
          <span className="editor-beta">Studio</span>
        </div>

        <div className="top-actions">
          <span className="save-status">
            <Cloud size={15} />
            {dirty
              ? "Unsaved changes"
              : isPublished
                ? `Published v${detail?.latestVersionNumber || 1}`
                : `Draft v${detail?.latestVersionNumber || 1}`}
          </span>
          {dirty ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDialog("discard")}
            >
              <RotateCcw size={13} /> Discard
            </Button>
          ) : null}
          <IconButton
            label="Version history"
            onClick={() => setDialog("history")}
          >
            <History size={16} />
          </IconButton>
          <span className="top-divider" />
          <div className="history-controls">
            <IconButton
              label="Undo (Ctrl+Z)"
              disabled={!past.length || !canWrite}
              onClick={undo}
            >
              <Undo2 size={16} />
            </IconButton>
            <IconButton
              label="Redo (Ctrl+Shift+Z)"
              disabled={!future.length || !canWrite}
              onClick={redo}
            >
              <Redo2 size={16} />
            </IconButton>
          </div>
          <Button
            onClick={() => setPreview(preview === "page" ? null : "page")}
          >
            <Eye size={15} />
            <span>
              {preview === "page" ? "Exit preview" : "Preview changes"}
            </span>
          </Button>
          <Button
            variant="primary"
            className="publish-button"
            disabled={!canPublish || publishMutation.isPending}
            onClick={() => setDialog("publish")}
          >
            <span>Publish</span>
            <ArrowUpRight size={15} />
          </Button>
        </div>
      </header>

      <div
        className={cn("editor-body", panel && `panel-${panel}`)}
        data-panel={panel || undefined}
      >
        {preview !== "page" ? (
          <nav className="editor-rail" aria-label="Editor navigation">
            <IconButton
              label="Page structure"
              className="rail-selected"
              onClick={() =>
                setPanel(panel === "structure" ? null : "structure")
              }
            >
              <Layers size={18} />
            </IconButton>
            <Link
              href="/admin/assistant"
              title="AI Operator"
              aria-label="AI Workspace"
            >
              <Sparkles size={18} />
            </Link>

            <div className="rail-bottom">
              <IconButton
                label="Command palette"
                onClick={() => setDialog("command")}
              >
                <CommandIcon size={17} />
              </IconButton>
              <IconButton
                label="Toggle theme"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </IconButton>
              <Link
                href="/admin/general"
                title="Settings"
                aria-label="Workspace settings"
              >
                <CircleHelp size={18} />
              </Link>
              <Link
                className="avatar"
                href="/admin/users"
                title="Team members"
                aria-label="Team members"
              >
                DC
              </Link>
            </div>
          </nav>
        ) : null}

        {preview !== "page" ? (
          <StructurePanel
            blocks={blocks}
            currentPage={detail?.slug || selectedSlug}
            pages={pageSlugs}
            setPage={(slug) => {
              if (dirty) {
                setNextPageSlug(slug);
                setDialog("switch");
              } else {
                switchPage(slug);
              }
            }}
            selectedId={selectedBlock?.id || ""}
            select={(id) => {
              setSelection(id);
              setPanel("inspector");
            }}
            add={() => {
              if (!canWrite) return;
              setLibraryQuery("");
              setDialog("library");
            }}
            move={moveSelected}
            reorder={reorderBlocks}
            duplicate={duplicateSelected}
            remove={() => canWrite && setDialog("delete")}
            toggleVisibility={() =>
              canWrite &&
              selectedBlock &&
              updateSelected({ visible: !selectedBlock.visible })
            }
          />
        ) : null}

        <EditorCanvas
          page={detail?.title || detail?.slug || "Page"}
          pageSlug={detail?.slug || "home"}
          themeStyle={themeStyle}
          canWrite={canWrite}
          mode={mode}
          setMode={setMode}
          preview={preview}
          setPreview={setPreview}
          showBlocks={showBlocks}
          selectedBlock={selectedBlock}
          activeProposal={proposal}
          isPublished={isPublished}
          dirty={dirty}
          ready={Boolean(detail) && !saveDraftMutation.isPending}
          catalog={catalogQuery.data?.items || []}
          select={(id) => {
            setSelection(id);
            setPanel("inspector");
          }}
          move={moveSelected}
          duplicate={duplicateSelected}
          toggleVisibility={() =>
            canWrite &&
            selectedBlock &&
            updateSelected({ visible: !selectedBlock.visible })
          }
          requestDelete={() => canWrite && setDialog("delete")}
          focusAI={() => {
            setTab("ai");
            setPanel("inspector");
          }}
          saveDraft={() => saveDraftMutation.mutate(blocks)}
          openPanel={(p) => setPanel(panel === p ? null : p)}
          openCommand={() => setDialog("command")}
          acceptProposal={() => resolveProposal(true)}
          rejectProposal={() => resolveProposal(false)}
        />

        {preview !== "page" ? (
          <InspectorPanel
            tab={tab}
            setTab={setTab}
            block={selectedBlock || null}
            update={updateSelected}
            proposal={proposal}
            previewing={preview === "proposal"}
            messages={messages}
            busy={busy}
            applyBusy={applyPlanMutation.isPending}
            statusLine={statusLine}
            canWrite={canWrite}
            canUseAi={canUseAi}
            send={(text) => {
              void send(text);
            }}
            togglePreview={() =>
              setPreview(preview === "proposal" ? null : "proposal")
            }
            accept={() => resolveProposal(true)}
            reject={() => resolveProposal(false)}
            closeMobile={() => setPanel(null)}
            model={model}
            setModel={setModel}
          />
        ) : null}
      </div>

      {dialog === "library" ? (
        <Modal
          wide
          title="Section Library"
          description="Add a validated CMS section below your current selection."
          close={() => setDialog(null)}
        >
          <label className="search-field">
            <Search size={15} />
            <input
              autoFocus
              aria-label="Search sections"
              placeholder="Find a section (Hero, Testimonials, FAQ, Product Grid…)"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
            />
          </label>
          <div className="library-categories">
            {categoriesOrder.map((cat) => {
              const matching = blockKinds.filter(
                (kind) =>
                  blockMeta[kind].category === cat &&
                  (kind.toLowerCase().includes(libraryQuery.toLowerCase()) ||
                    blockMeta[kind].description
                      .toLowerCase()
                      .includes(libraryQuery.toLowerCase()))
              );
              if (!matching.length) return null;
              return (
                <div key={cat} className="library-group">
                  <h3>{cat}</h3>
                  <div className="library-grid">
                    {matching.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        className="library-card"
                        onClick={() => {
                          const item = makeBlock(kind, newId());
                          const idx = selectedBlock
                            ? blocks.indexOf(selectedBlock) + 1
                            : 0;
                          commit([
                            ...blocks.slice(0, idx),
                            item,
                            ...blocks.slice(idx),
                          ]);
                          setSelection(item.id);
                          setTab("properties");
                          setDialog(null);
                          setToast(`Added ${kind}`);
                        }}
                      >
                        <span className="proposal-icon">
                          <SectionIcon kind={kind} size={15} />
                        </span>
                        <div>
                          <strong>{kind}</strong>
                          <small>{blockMeta[kind].description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}

      {dialog === "history" && detail ? (
        <Modal
          wide
          title={`Version history · ${detail.title}`}
          description="Inspect saved draft/published versions or roll back cleanly."
          close={() => setDialog(null)}
        >
          <div className="form-stack">
            {(detail.versions || []).map((v) => {
              const isLive = v.id === detail.publishedVersionId;
              return (
                <div
                  key={v.id}
                  className="panel"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="button-row">
                      <strong>Version {v.versionNumber}</strong>
                      {isLive ? <Badge tone="green">Published</Badge> : null}
                      {v.id === detail.latestVersion?.id ? (
                        <Badge tone="accent">Latest</Badge>
                      ) : null}
                    </div>
                    <p className="muted" style={{ fontSize: 12 }}>
                      {v.changeSummary || "Saved CMS revision"} ·{" "}
                      {formatDateTime(v.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      !canPublish || rollbackMutation.isPending || isLive
                    }
                    onClick={() => rollbackMutation.mutate(v.id)}
                  >
                    Restore version
                  </Button>
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}

      {dialog === "command" ? (
        <CommandPalette commands={commands} close={() => setDialog(null)} />
      ) : null}

      {dialog === "publish" ? (
        <ConfirmDialog
          title={`Publish "${detail?.slug || selectedSlug}"?`}
          description="Publishing replaces the live storefront version of this page with your current draft."
          confirmLabel={
            publishMutation.isPending ? "Publishing…" : "Confirm publish"
          }
          summary={
            <div>
              <span>
                {liveBlocks.filter((i) => i.visible).length} live visible
                sections
              </span>
              <ArrowDown size={14} style={{ margin: "4px 0" }} />
              <strong>
                {blocks.filter((i) => i.visible).length} visible sections after
                publishing
              </strong>
              <small>
                {
                  blocks.filter(
                    (i) =>
                      JSON.stringify(i) !==
                      JSON.stringify(liveBlocks.find((o) => o.id === i.id))
                  ).length
                }{" "}
                added or updated ·{" "}
                {
                  liveBlocks.filter((i) => !blocks.some((n) => n.id === i.id))
                    .length
                }{" "}
                removed
              </small>
            </div>
          }
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            if (!publishMutation.isPending) {
              publishMutation.mutate();
            }
          }}
        />
      ) : null}

      {dialog === "discard" || dialog === "switch" || dialog === "delete" ? (
        <ConfirmDialog
          title={
            dialog === "delete"
              ? `Delete "${selectedBlock?.label || "section"}"?`
              : "Discard unsaved changes?"
          }
          description={
            dialog === "delete"
              ? "This section will be removed from the current working draft."
              : "Your unsaved edits will be reverted to the last saved draft."
          }
          confirmLabel={
            dialog === "delete" ? "Delete section" : "Discard changes"
          }
          destructive
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            if (dialog === "delete") {
              commit(blocks.filter((item) => item.id !== selectedBlock?.id));
              setToast("Section removed");
            } else if (dialog === "switch") {
              switchPage(nextPageSlug);
              setToast(`Switched to ${nextPageSlug}`);
            } else {
              setWorkingState(null);
              setPast([]);
              setFuture([]);
              setPreview(null);
              setToast("Unsaved changes discarded");
            }
            setDialog(null);
          }}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
