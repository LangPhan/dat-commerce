"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { Toast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";
import {
  createRestCommerceAdapter,
  createRestPageAdapter,
} from "@/features/builder/adapters";
import { extractPageDocumentV2 } from "@/features/builder/migration";
import { createElementNode } from "@/features/builder/registry/definitions";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { EditorCanvas } from "./EditorCanvas";
import { EditorTopBar } from "./EditorTopBar";
import { LeftSidebar } from "./LeftSidebar";
import { VisualInspector } from "./VisualInspector";
import { EditorDndProvider } from "./dnd/EditorDndProvider";

export function Editor() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const canPublish = hasPermission("content:publish");
  const canUseAi = hasPermission("ai:use");

  const pageAdapter = useMemo(() => createRestPageAdapter(), []);
  const commerceAdapter = useMemo(() => createRestCommerceAdapter(), []);

  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [toast, setToast] = useState("");
  const hydratedPageKeyRef = useRef<string>("");
  const hydratedThemeIdRef = useRef<string>("");

  const previewMode = useEditorStore((s) => s.previewMode);
  const pageId = useEditorStore((s) => s.pageId);
  const pageTitle = useEditorStore((s) => s.pageTitle);
  const seoTitle = useEditorStore((s) => s.seoTitle);
  const seoDescription = useEditorStore((s) => s.seoDescription);
  const pageVersion = useEditorStore((s) => s.pageVersion);
  const nodes = useEditorStore((s) => s.nodes);
  const dirty = useEditorStore((s) => s.dirty);
  const themeTokens = useEditorStore((s) => s.themeTokens);

  const loadPage = useEditorStore((s) => s.loadPage);
  const markSaved = useEditorStore((s) => s.markSaved);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const setThemeTokens = useEditorStore((s) => s.setThemeTokens);
  const markThemeSaved = useEditorStore((s) => s.markThemeSaved);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);
  const revertAiPreview = useEditorStore((s) => s.revertAiPreview);
  const selectNode = useEditorStore((s) => s.selectNode);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const pagesQuery = useQuery({
    queryKey: ["cms-admin-pages"],
    queryFn: () => pageAdapter.listPages(),
  });

  const activeId =
    selectedPageId ||
    pagesQuery.data?.find((p) => p.slug === "home")?.id ||
    pagesQuery.data?.[0]?.id ||
    "";

  const pageDetailQuery = useQuery({
    queryKey: ["cms-admin-page", activeId],
    queryFn: () => pageAdapter.getPage(activeId),
    enabled: Boolean(activeId),
  });

  const themeQuery = useQuery({
    queryKey: ["cms-admin-theme"],
    queryFn: () => pageAdapter.getTheme(),
  });

  const productsQuery = useQuery({
    queryKey: ["editor-store-products"],
    queryFn: () => commerceAdapter.listProducts(),
    staleTime: 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["editor-store-categories"],
    queryFn: () => commerceAdapter.listCategories(),
    staleTime: 60_000,
  });

  useEffect(() => {
    const detail = pageDetailQuery.data;
    if (!detail) return;
    const versionKey = `${detail.id}:${detail.latestVersionNumber}:${detail.version}`;
    if (hydratedPageKeyRef.current === versionKey) return;
    hydratedPageKeyRef.current = versionKey;

    const v2Doc = extractPageDocumentV2(detail.latestVersion?.content);
    loadPage({
      pageId: detail.id,
      pageSlug: detail.slug,
      pageTitle: detail.title,
      seoTitle: detail.seoTitle,
      seoDescription: detail.seoDescription,
      pageVersion: detail.version,
      publishedVersionId: detail.publishedVersionId,
      latestVersionNumber: detail.latestVersionNumber,
      status: detail.status,
      nodes: v2Doc.nodes,
    });
  }, [pageDetailQuery.data, loadPage]);

  useEffect(() => {
    const latestTheme = themeQuery.data?.latest || themeQuery.data?.published;
    if (!latestTheme) return;
    if (hydratedThemeIdRef.current === latestTheme.id) return;
    hydratedThemeIdRef.current = latestTheme.id;
    setThemeTokens(latestTheme.tokens, false);
  }, [themeQuery.data, setThemeTokens]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      setSaveStatus("saving");
      return pageAdapter.saveDraft({
        pageId,
        document: { version: 2, nodes },
        title: pageTitle,
        seoTitle,
        seoDescription,
        expectedVersion: pageVersion,
        changeSummary: "Saved visual editor draft",
      });
    },
    onSuccess: (updated) => {
      hydratedPageKeyRef.current = `${updated.id}:${updated.latestVersionNumber}:${updated.version}`;
      markSaved({
        pageVersion: updated.version,
        latestVersionNumber: updated.latestVersionNumber,
        publishedVersionId: updated.publishedVersionId,
        status: updated.status,
      });
      queryClient.setQueryData(["cms-admin-page", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-pages"] });
      setToast(`Draft saved (v${updated.latestVersionNumber})`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to save draft";
      setSaveStatus("error", msg);
      setToast(msg);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      let currentVersion = pageVersion;
      if (dirty) {
        setSaveStatus("saving");
        const saved = await pageAdapter.saveDraft({
          pageId,
          document: { version: 2, nodes },
          title: pageTitle,
          seoTitle,
          seoDescription,
          expectedVersion: pageVersion,
          changeSummary: "Saved before publish",
        });
        hydratedPageKeyRef.current = `${saved.id}:${saved.latestVersionNumber}:${saved.version}`;
        currentVersion = saved.version;
      }
      return pageAdapter.publishPage({
        pageId,
        expectedVersion: currentVersion,
      });
    },
    onSuccess: (published) => {
      hydratedPageKeyRef.current = `${published.id}:${published.latestVersionNumber}:${published.version}`;
      markSaved({
        pageVersion: published.version,
        latestVersionNumber: published.latestVersionNumber,
        publishedVersionId: published.publishedVersionId,
        status: published.status,
      });
      queryClient.setQueryData(["cms-admin-page", published.id], published);
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["store-cms-page"] });
      setToast(`Published "${published.title}" to live storefront`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Publish failed");
    },
  });

  const createPageMutation = useMutation({
    mutationFn: async (body: { slug: string; title: string }) => {
      const starterHero = createElementNode("section");
      starterHero.label = "Hero Section";
      const h1 = createElementNode("heading");
      h1.props = { text: body.title, tag: "h1", href: "" };
      starterHero.children = [h1];
      return pageAdapter.createPage({
        slug: body.slug,
        title: body.title,
        content: { version: 2, nodes: [starterHero] },
      });
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-pages"] });
      setSelectedPageId(created.id);
      setToast(`Created page /${created.slug}`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Could not create page");
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => pageAdapter.rollbackPage(pageId, versionId),
    onSuccess: (rolled) => {
      hydratedPageKeyRef.current = "";
      queryClient.setQueryData(["cms-admin-page", rolled.id], rolled);
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["store-cms-page"] });
      setToast(`Rolled back and published v${rolled.latestVersionNumber}`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Rollback failed");
    },
  });

  const saveThemeMutation = useMutation({
    mutationFn: async () => {
      if (!themeTokens) throw new Error("No theme loaded");
      return pageAdapter.saveThemeDraft(themeTokens, "Updated in Visual Editor");
    },
    onSuccess: () => {
      markThemeSaved();
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      setToast("Theme tokens saved as draft");
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Failed to save theme");
    },
  });

  const publishThemeMutation = useMutation({
    mutationFn: async () => {
      if (!themeTokens) throw new Error("No theme loaded");
      const saved = await pageAdapter.saveThemeDraft(
        themeTokens,
        "Published from Visual Editor"
      );
      return pageAdapter.publishTheme(saved.id);
    },
    onSuccess: () => {
      markThemeSaved();
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      void queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      setToast("Theme tokens published live");
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Theme publish failed");
    },
  });

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
      );

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canWrite && pageId && !saveDraftMutation.isPending) {
          saveDraftMutation.mutate();
        }
        return;
      }

      if (isEditingField) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (canWrite) duplicateSelected();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (canWrite) deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        if (useEditorStore.getState().aiPreview) {
          revertAiPreview();
        } else {
          selectNode(null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canWrite,
    pageId,
    saveDraftMutation,
    undo,
    redo,
    duplicateSelected,
    deleteSelected,
    revertAiPreview,
    selectNode,
  ]);

  if (pagesQuery.isLoading || (activeId && pageDetailQuery.isLoading)) {
    return (
      <div className="ed-loading-shell">
        <Skeleton rows={8} />
      </div>
    );
  }

  if (pagesQuery.isError) {
    return (
      <div className="ed-loading-shell">
        <Empty
          title="Could not load Visual Editor"
          text={
            pagesQuery.error instanceof Error
              ? pagesQuery.error.message
              : "Check API connectivity and content:read permission."
          }
        />
      </div>
    );
  }

  return (
    <div className="ed-workspace">
      <EditorTopBar
        pages={pagesQuery.data || []}
        activePageDetail={pageDetailQuery.data}
        canWrite={canWrite}
        canPublish={canPublish}
        savingDraft={saveDraftMutation.isPending}
        publishing={publishMutation.isPending}
        creatingPage={createPageMutation.isPending}
        rollingBack={rollbackMutation.isPending}
        onSelectPage={(nextId) => {
          hydratedPageKeyRef.current = "";
          setSelectedPageId(nextId);
        }}
        onCreatePage={async (body) => {
          await createPageMutation.mutateAsync(body);
        }}
        onSaveDraft={() => saveDraftMutation.mutate()}
        onPublish={() => publishMutation.mutate()}
        onRollbackVersion={(verId) => rollbackMutation.mutate(verId)}
      />

      <EditorDndProvider onNotify={setToast}>
        <div className="ed-workbench">
          {!previewMode ? <LeftSidebar /> : null}

          <EditorCanvas
            catalog={productsQuery.data || []}
            categories={categoriesQuery.data || []}
            canUseAi={canUseAi}
            canWrite={canWrite}
            onNotify={setToast}
          />

          {!previewMode ? (
            <VisualInspector
              products={productsQuery.data || []}
              categories={categoriesQuery.data || []}
              canWrite={canWrite}
              canPublish={canPublish}
              savingTheme={saveThemeMutation.isPending}
              publishingTheme={publishThemeMutation.isPending}
              onSaveTheme={() => saveThemeMutation.mutate()}
              onPublishTheme={() => publishThemeMutation.mutate()}
            />
          ) : null}
        </div>
      </EditorDndProvider>

      <Toast message={toast} />
    </div>
  );
}
