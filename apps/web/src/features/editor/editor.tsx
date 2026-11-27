"use client";

import { revalidateStorefrontCache } from "@/lib/revalidate-store";
import { STORE_CACHE_TAGS } from "@/lib/store-cache-tags";

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
import { dtoToPresetDefinition } from "@/features/motion/presets";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { EditorCanvas } from "./EditorCanvas";
import { EditorTopBar } from "./EditorTopBar";
import { LeftSidebar } from "./LeftSidebar";
import { VisualInspector } from "./VisualInspector";
import { createCustomPaletteColor } from "./brand-palette";
import { EditorDndProvider } from "./dnd/EditorDndProvider";

export function Editor() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const canPublish = hasPermission("content:publish");
  const canUseAi = hasPermission("ai:use");
  const canUploadMedia = hasPermission("media:write");

  const pageAdapter = useMemo(() => createRestPageAdapter(), []);
  const commerceAdapter = useMemo(() => createRestCommerceAdapter(), []);

  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [toast, setToast] = useState("");
  const hydratedPageKeyRef = useRef<string>("");
  const hydratedThemeIdRef = useRef<string>("");

  const previewMode = useEditorStore((s) => s.previewMode);
  const pageId = useEditorStore((s) => s.pageId);

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

  const animationPresetsQuery = useQuery({
    queryKey: ["cms-animation-presets"],
    queryFn: () => cmsAdminApi.listAnimationPresets(),
    staleTime: 60_000,
  });

  const customAnimationPresets = useMemo(
    () => (animationPresetsQuery.data || []).map(dtoToPresetDefinition),
    [animationPresetsQuery.data]
  );

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
      const state = useEditorStore.getState();
      setSaveStatus("saving");
      if (state.themeDirty && state.themeTokens) {
        const savedTheme = await pageAdapter.saveThemeDraft(
          state.themeTokens,
          "Saved theme draft from Visual Editor"
        );
        hydratedThemeIdRef.current = savedTheme.id;
        markThemeSaved();
        void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      }
      return pageAdapter.saveDraft({
        pageId: state.pageId,
        document: { version: 2, nodes: state.nodes },
        title: state.pageTitle,
        seoTitle: state.seoTitle,
        seoDescription: state.seoDescription,
        expectedVersion: state.pageVersion,
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
      const state = useEditorStore.getState();
      let currentVersion = state.pageVersion;
      if (state.dirty) {
        setSaveStatus("saving");
        const saved = await pageAdapter.saveDraft({
          pageId: state.pageId,
          document: { version: 2, nodes: state.nodes },
          title: state.pageTitle,
          seoTitle: state.seoTitle,
          seoDescription: state.seoDescription,
          expectedVersion: state.pageVersion,
          changeSummary: "Saved before publish",
        });
        hydratedPageKeyRef.current = `${saved.id}:${saved.latestVersionNumber}:${saved.version}`;
        currentVersion = saved.version;
      }
      const latestTheme = themeQuery.data?.latest;
      const publishedTheme = themeQuery.data?.published;
      const hasUnpublishedThemeDraft = Boolean(
        latestTheme && latestTheme.id !== publishedTheme?.id
      );
      if (state.themeDirty && state.themeTokens) {
        const savedTheme = await pageAdapter.saveThemeDraft(
          state.themeTokens,
          "Published with page from Visual Editor"
        );
        const pubTheme = await pageAdapter.publishTheme(savedTheme.id);
        hydratedThemeIdRef.current = pubTheme.id;
        markThemeSaved();
        queryClient.setQueryData(["store-theme"], pubTheme);
        void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
        void queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      } else if (hasUnpublishedThemeDraft && latestTheme) {
        const pubTheme = await pageAdapter.publishTheme(latestTheme.id);
        hydratedThemeIdRef.current = pubTheme.id;
        markThemeSaved();
        queryClient.setQueryData(["store-theme"], pubTheme);
        void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
        void queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      }
      return pageAdapter.publishPage({
        pageId: state.pageId,
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
      void revalidateStorefrontCache({
        tags: [STORE_CACHE_TAGS.pages, STORE_CACHE_TAGS.page(published.slug), STORE_CACHE_TAGS.theme],
        paths: ["/", published.slug === "home" ? "/" : `/store/${published.slug}`],
      }).catch(() => undefined);
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
    mutationFn: (versionId: string) =>
      pageAdapter.rollbackPage(useEditorStore.getState().pageId, versionId),
    onSuccess: (rolled) => {
      hydratedPageKeyRef.current = "";
      queryClient.setQueryData(["cms-admin-page", rolled.id], rolled);
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["store-cms-page"] });
      void revalidateStorefrontCache({
        tags: [STORE_CACHE_TAGS.pages, STORE_CACHE_TAGS.page(rolled.slug)],
        paths: ["/", rolled.slug === "home" ? "/" : `/store/${rolled.slug}`],
      }).catch(() => undefined);
      setToast(`Rolled back and published v${rolled.latestVersionNumber}`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Rollback failed");
    },
  });

  const saveThemeMutation = useMutation({
    mutationFn: async () => {
      const currentTheme = useEditorStore.getState().themeTokens;
      if (!currentTheme) throw new Error("No theme loaded");
      return pageAdapter.saveThemeDraft(currentTheme, "Updated in Visual Editor");
    },
    onSuccess: (saved) => {
      hydratedThemeIdRef.current = saved.id;
      markThemeSaved();
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      setToast("Theme tokens saved as draft");
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Failed to save theme");
    },
  });

  const publishThemeMutation = useMutation({
    mutationFn: async () => {
      const currentTheme = useEditorStore.getState().themeTokens;
      if (!currentTheme) throw new Error("No theme loaded");
      const saved = await pageAdapter.saveThemeDraft(
        currentTheme,
        "Published from Visual Editor"
      );
      return pageAdapter.publishTheme(saved.id);
    },
    onSuccess: (published) => {
      hydratedThemeIdRef.current = published.id;
      markThemeSaved();
      queryClient.setQueryData(["store-theme"], published);
      void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
      void queryClient.invalidateQueries({ queryKey: ["store-theme"] });
      void revalidateStorefrontCache({
        tags: [STORE_CACHE_TAGS.theme],
        paths: ["/"],
      }).catch(() => undefined);
      setToast("Theme tokens published live");
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Theme publish failed");
    },
  });

  const handleAddBrandColor = (name: string, hex: string) => {
    const current = useEditorStore.getState().themeTokens;
    if (!current) return;
    const existing = current.customPalette || [];
    if (existing.length >= 24) {
      setToast("Brand Palette supports up to 24 custom colors");
      return;
    }
    const createdSwatch = createCustomPaletteColor(name, hex, existing);
    const nextTokens = {
      ...current,
      customPalette: [...existing, createdSwatch],
    };
    setThemeTokens(nextTokens, true);
    if (!canWrite) return;
    void pageAdapter
      .saveThemeDraft(nextTokens, `Added brand color ${createdSwatch.name}`)
      .then((saved) => {
        hydratedThemeIdRef.current = saved.id;
        if (useEditorStore.getState().themeTokens === nextTokens) {
          markThemeSaved();
        }
        void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
        setToast(`Added "${createdSwatch.name}" (${createdSwatch.hex}) to Brand Palette`);
      })
      .catch((err) => {
        setToast(err instanceof Error ? err.message : "Failed to save brand color");
      });
  };

  const handleRemoveBrandColor = (id: string) => {
    const current = useEditorStore.getState().themeTokens;
    if (!current) return;
    const existing = current.customPalette || [];
    const target = existing.find((item) => item.id === id);
    if (!target) return;
    const nextTokens = {
      ...current,
      customPalette: existing.filter((item) => item.id !== id),
    };
    setThemeTokens(nextTokens, true);
    if (!canWrite) return;
    void pageAdapter
      .saveThemeDraft(nextTokens, `Removed brand color ${target.name}`)
      .then((saved) => {
        hydratedThemeIdRef.current = saved.id;
        if (useEditorStore.getState().themeTokens === nextTokens) {
          markThemeSaved();
        }
        void queryClient.invalidateQueries({ queryKey: ["cms-admin-theme"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-theme"] });
        setToast(`Removed "${target.name}" from Brand Palette`);
      })
      .catch((err) => {
        setToast(err instanceof Error ? err.message : "Failed to remove brand color");
      });
  };

  const shortcutStateRef = useRef({
    canWrite,
    saveDraft: () => {
      if (!saveDraftMutation.isPending) {
        saveDraftMutation.mutate();
      }
    },
  });
  shortcutStateRef.current = {
    canWrite,
    saveDraft: () => {
      if (!saveDraftMutation.isPending) {
        saveDraftMutation.mutate();
      }
    },
  };

  // Global keyboard shortcuts (bound once)
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
        if (shortcutStateRef.current.canWrite && useEditorStore.getState().pageId) {
          shortcutStateRef.current.saveDraft();
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
        if (shortcutStateRef.current.canWrite) duplicateSelected();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (shortcutStateRef.current.canWrite) deleteSelected();
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
    undo,
    redo,
    duplicateSelected,
    deleteSelected,
    revertAiPreview,
    selectNode,
  ]);

  if (
    pagesQuery.isLoading ||
    themeQuery.isLoading ||
    (activeId && pageDetailQuery.isLoading) ||
    (activeId && !pageDetailQuery.isError && pageId !== activeId)
  ) {
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
            fallbackThemeTokens={
              themeQuery.data?.latest?.tokens || themeQuery.data?.published?.tokens || null
            }
            customPresets={customAnimationPresets}
            canUseAi={canUseAi}
            canWrite={canWrite}
            onNotify={setToast}
          />

          {!previewMode ? (
            <VisualInspector
              products={productsQuery.data || []}
              categories={categoriesQuery.data || []}
              customPresets={customAnimationPresets}
              canWrite={canWrite}
              canPublish={canPublish}
              canUploadMedia={canUploadMedia}
              savingTheme={saveThemeMutation.isPending}
              publishingTheme={publishThemeMutation.isPending}
              onSaveTheme={() => saveThemeMutation.mutate()}
              onPublishTheme={() => publishThemeMutation.mutate()}
              onAddBrandColor={handleAddBrandColor}
              onRemoveBrandColor={handleRemoveBrandColor}
              onNotify={setToast}
            />
          ) : null}
        </div>
      </EditorDndProvider>

      <Toast message={toast} />
    </div>
  );
}
