"use client";

import { revalidateStorefrontCache } from "@/lib/revalidate-store";
import { STORE_CACHE_TAGS } from "@/lib/store-cache-tags";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Empty, Skeleton } from "@/components/ui/data-display";
import { Toast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-context";
import {
  createRestCommerceAdapter,
  createRestPageAdapter,
} from "@/features/builder/adapters";
import { extractPageDocumentV2 } from "@/features/builder/migration";
import { experienceAdminApi } from "../api";
import { EFFECT_BY_TYPE } from "../catalog";
import type { EffectLayerType, ExperienceZone, RecurrenceRule } from "../types";
import { useExperienceStudioStore } from "./experience-store";
import { ExperienceInspector } from "./ExperienceInspector";
import { ExperienceLeftPanel } from "./ExperienceLeftPanel";
import { ExperiencePreviewStage } from "./ExperiencePreviewStage";
import { ExperienceTopBar } from "./ExperienceTopBar";

export function ExperienceStudio({
  experienceId,
}: {
  experienceId: string;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("content:write");
  const canPublish = hasPermission("content:publish");
  const canUseAi = hasPermission("ai:use");

  const pageAdapter = useMemo(() => createRestPageAdapter(), []);
  const commerceAdapter = useMemo(() => createRestCommerceAdapter(), []);

  const [toast, setToast] = useState("");
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [activePaletteDrag, setActivePaletteDrag] = useState(false);
  const hydratedKeyRef = useRef("");

  const loadExperience = useExperienceStudioStore((s) => s.loadExperience);
  const markSaved = useExperienceStudioStore((s) => s.markSaved);
  const addLayer = useExperienceStudioStore((s) => s.addLayer);
  const reorderLayers = useExperienceStudioStore((s) => s.reorderLayers);
  const undo = useExperienceStudioStore((s) => s.undo);
  const redo = useExperienceStudioStore((s) => s.redo);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const detailQuery = useQuery({
    queryKey: ["admin-experience", experienceId],
    queryFn: () => experienceAdminApi.get(experienceId),
    enabled: Boolean(experienceId),
  });

  const templatesQuery = useQuery({
    queryKey: ["admin-experience-templates"],
    queryFn: () => experienceAdminApi.listTemplates(),
    staleTime: 300_000,
  });

  const listQuery = useQuery({
    queryKey: ["admin-experiences"],
    queryFn: () => experienceAdminApi.list(),
    staleTime: 30_000,
  });

  const pagesQuery = useQuery({
    queryKey: ["cms-admin-pages"],
    queryFn: () => pageAdapter.listPages(),
    staleTime: 60_000,
  });

  const homePageId = useMemo(
    () =>
      pagesQuery.data?.find((p) => p.slug === "home")?.id ||
      pagesQuery.data?.[0]?.id ||
      "",
    [pagesQuery.data]
  );

  const homeDetailQuery = useQuery({
    queryKey: ["cms-admin-page", homePageId],
    queryFn: () => pageAdapter.getPage(homePageId),
    enabled: Boolean(homePageId),
    staleTime: 60_000,
  });

  const themeQuery = useQuery({
    queryKey: ["cms-admin-theme"],
    queryFn: () => pageAdapter.getTheme(),
    staleTime: 60_000,
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

  const homeNodes = useMemo(
    () =>
      homeDetailQuery.data?.latestVersion?.content
        ? extractPageDocumentV2(homeDetailQuery.data.latestVersion.content).nodes
        : [],
    [homeDetailQuery.data]
  );

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail) return;
    const key = `${detail.id}:${detail.latestVersionNumber}:${detail.version}`;
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;
    loadExperience(detail);
  }, [detailQuery.data, loadExperience]);

  const saveVersionMutation = useMutation({
    mutationFn: async () => {
      const state = useExperienceStudioStore.getState();
      let currentVersion = state.version;
      if (state.metaDirty) {
        const updatedMeta = await experienceAdminApi.update(state.experienceId, {
          name: state.meta.name,
          category: state.meta.category,
          priority: state.interaction.priority,
          blendMode: state.interaction.blendMode,
          exclusiveGroups: state.interaction.exclusiveGroups,
          targetPages: state.interaction.targetPages,
          maxParticleBudget: state.interaction.maxParticleBudget,
          expectedVersion: currentVersion,
        });
        currentVersion = updatedMeta.version;
      }
      return experienceAdminApi.saveVersion(state.experienceId, {
        config: state.config,
        changeSummary: "Saved from Visual Experience Studio",
        expectedVersion: currentVersion,
        publishIfActive: true,
      });
    },
    onSuccess: (updated) => {
      hydratedKeyRef.current = `${updated.id}:${updated.latestVersionNumber}:${updated.version}`;
      markSaved(updated);
      queryClient.setQueryData(["admin-experience", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      setToast(`Saved v${updated.latestVersionNumber}`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Failed to save experience version");
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const state = useExperienceStudioStore.getState();
      if (state.dirty || state.metaDirty) {
        await saveVersionMutation.mutateAsync();
      }
      return experienceAdminApi.activate(state.experienceId);
    },
    onSuccess: (updated) => {
      hydratedKeyRef.current = `${updated.id}:${updated.latestVersionNumber}:${updated.version}`;
      markSaved(updated);
      queryClient.setQueryData(["admin-experience", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      setToast(`"${updated.name}" is now LIVE on storefront`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Activation failed");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () =>
      experienceAdminApi.deactivate(useExperienceStudioStore.getState().experienceId),
    onSuccess: (updated) => {
      hydratedKeyRef.current = `${updated.id}:${updated.latestVersionNumber}:${updated.version}`;
      markSaved(updated);
      queryClient.setQueryData(["admin-experience", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      setToast(`Paused "${updated.name}"`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Failed to deactivate");
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (body: {
      startsAt: string;
      endsAt?: string | null;
      timezone: string;
      recurrenceRule: RecurrenceRule;
    }) => {
      const state = useExperienceStudioStore.getState();
      if (state.dirty || state.metaDirty) {
        await saveVersionMutation.mutateAsync();
      }
      return experienceAdminApi.schedule(state.experienceId, body);
    },
    onSuccess: (updated) => {
      hydratedKeyRef.current = `${updated.id}:${updated.latestVersionNumber}:${updated.version}`;
      markSaved(updated);
      queryClient.setQueryData(["admin-experience", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      setToast(`Scheduled "${updated.name}" (${updated.status})`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Schedule failed");
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) =>
      experienceAdminApi.rollback(
        useExperienceStudioStore.getState().experienceId,
        versionId
      ),
    onSuccess: (updated) => {
      hydratedKeyRef.current = "";
      loadExperience(updated);
      queryClient.setQueryData(["admin-experience", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
      void queryClient.invalidateQueries({ queryKey: ["store-active-experience"] });
      void revalidateStorefrontCache({ tags: [STORE_CACHE_TAGS.experience], paths: ["/"] }).catch(() => undefined);
      setToast(`Restored snapshot into v${updated.latestVersionNumber}`);
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : "Rollback failed");
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canWrite && !saveVersionMutation.isPending) {
          saveVersionMutation.mutate();
        }
        return;
      }
      if (isTextInput) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canWrite, saveVersionMutation, undo, redo]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as
      | { kind?: string; label?: string }
      | undefined;
    setActiveDragLabel(data?.label || "Effect");
    setActivePaletteDrag(data?.kind === "effect-palette");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLabel(null);
    setActivePaletteDrag(false);
    const { active, over } = event;
    const activeData = active.data.current as
      | { kind?: string; effectType?: EffectLayerType; layerId?: string }
      | undefined;

    if (!activeData || !canWrite) return;

    if (activeData.kind === "effect-palette" && activeData.effectType) {
      const overData = over?.data.current as
        | { kind?: string; zone?: ExperienceZone }
        | undefined;
      const targetZone =
        overData?.kind === "exp-zone" ? overData.zone : undefined;
      addLayer(activeData.effectType, targetZone);
      const def = EFFECT_BY_TYPE[activeData.effectType];
      setToast(
        `Added ${def?.name || activeData.effectType}${targetZone ? ` to ${targetZone}` : ""}`
      );
      return;
    }

    if (activeData.kind === "layer-sort" && over && active.id !== over.id) {
      const layers = useExperienceStudioStore.getState().config.layers;
      const fromIdx = layers.findIndex((l) => l.id === active.id);
      const toIdx = layers.findIndex((l) => l.id === over.id);
      if (fromIdx >= 0 && toIdx >= 0) {
        reorderLayers(fromIdx, toIdx);
      }
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="ed-loading-shell">
        <Skeleton rows={8} />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="ed-loading-shell">
        <Empty
          icon={<Sparkles size={24} />}
          title="Experience not found"
          text="This seasonal experience may have been deleted or belongs to another store."
        />
      </div>
    );
  }

  const baseThemeTokens =
    themeQuery.data?.latest?.tokens || themeQuery.data?.published?.tokens || null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveDragLabel(null);
        setActivePaletteDrag(false);
      }}
    >
      <div className="ed-workspace exp-studio">
        <ExperienceTopBar
          detail={detailQuery.data}
          canWrite={canWrite}
          canPublish={canPublish}
          saving={saveVersionMutation.isPending}
          activating={activateMutation.isPending || deactivateMutation.isPending}
          scheduling={scheduleMutation.isPending}
          rollingBack={rollbackMutation.isPending}
          onSaveVersion={() => saveVersionMutation.mutate()}
          onActivate={() => activateMutation.mutate()}
          onDeactivate={() => deactivateMutation.mutate()}
          onSchedule={(body) => scheduleMutation.mutate(body)}
          onRollback={(versionId) => rollbackMutation.mutate(versionId)}
        />

        <div className="ed-workbench">
          <ExperienceLeftPanel
            templates={templatesQuery.data || []}
            canWrite={canWrite}
            onNotify={setToast}
          />

          <ExperiencePreviewStage
            homeNodes={homeNodes}
            baseThemeTokens={baseThemeTokens}
            catalog={productsQuery.data || []}
            categories={categoriesQuery.data || []}
            activePaletteDrag={activePaletteDrag}
            canUseAi={canUseAi}
            canWrite={canWrite}
            onNotify={setToast}
          />

          <ExperienceInspector
            allExperiences={listQuery.data || []}
            canWrite={canWrite}
            canPublish={canPublish}
            scheduling={scheduleMutation.isPending}
            onSchedule={(body) => scheduleMutation.mutate(body)}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragLabel ? (
            <div className="ed-drag-pill">{activeDragLabel}</div>
          ) : null}
        </DragOverlay>

        <Toast message={toast} />
      </div>
    </DndContext>
  );
}
