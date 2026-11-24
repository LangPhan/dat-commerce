import { create } from "zustand";
import type { ThemeTokens } from "@/types/api-cms-ai";
import {
  applyOperation,
  applyOperations,
  canAcceptChild,
  cloneSubtreeWithFreshIds,
  countTreeNodes,
  findNode,
  findParent,
} from "../operations";
import { createElementNode } from "../registry/definitions";
import type {
  AiPreviewSession,
  EditorOperation,
  ElementNode,
  ElementType,
  HistoryEntry,
  SaveStatus,
  StylePropertyKey,
  StyleValues,
  ViewportMode,
} from "../types";

const MAX_HISTORY = 100;

export interface EditorStoreState {
  pageId: string;
  pageSlug: string;
  pageTitle: string;
  seoTitle: string;
  seoDescription: string;
  pageVersion: number | undefined;
  publishedVersionId: string | null;
  latestVersionNumber: number;
  status: string;

  nodes: ElementNode[];
  selectedIds: string[];
  hoveredId: string | null;
  expandedLayerIds: Record<string, boolean>;

  themeTokens: ThemeTokens | null;
  themeDirty: boolean;

  viewport: ViewportMode;
  zoom: number;
  showOutlines: boolean;
  showGrid: boolean;
  previewMode: boolean;

  dirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;

  history: HistoryEntry[];
  historyIndex: number;

  aiPreview: AiPreviewSession | null;

  loadPage: (params: {
    pageId: string;
    pageSlug: string;
    pageTitle: string;
    seoTitle?: string | null;
    seoDescription?: string | null;
    pageVersion?: number;
    publishedVersionId?: string | null;
    latestVersionNumber?: number;
    status?: string;
    nodes: ElementNode[];
  }) => void;
  setPageMeta: (meta: {
    pageTitle?: string;
    seoTitle?: string;
    seoDescription?: string;
  }) => void;
  markSaved: (params: {
    pageVersion: number;
    latestVersionNumber: number;
    publishedVersionId?: string | null;
    status?: string;
  }) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;

  setThemeTokens: (tokens: ThemeTokens, markDirty?: boolean) => void;
  markThemeSaved: () => void;

  selectNode: (id: string | null, opts?: { additive?: boolean }) => void;
  setHoveredId: (id: string | null) => void;
  toggleLayerExpanded: (id: string) => void;
  expandAncestors: (ids: string[]) => void;

  setViewport: (vp: ViewportMode) => void;
  setZoom: (zoom: number) => void;
  setShowOutlines: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setPreviewMode: (preview: boolean) => void;

  executeOperation: (
    op: EditorOperation,
    opts?: { source?: "manual" | "ai" | "system"; summary?: string; model?: string; nextSelectedIds?: string[] }
  ) => boolean;
  executeBatch: (
    ops: EditorOperation[],
    opts: { source?: "manual" | "ai"; summary: string; model?: string; nextSelectedIds?: string[] }
  ) => boolean;

  insertElement: (type: ElementType, parentId?: string | null, index?: number) => ElementNode | null;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  updateNodeProps: (nodeId: string, props: Record<string, unknown>, label?: string) => void;
  updateNodeStyles: (
    nodeId: string,
    styles: StyleValues,
    breakpoint?: "base" | "tablet" | "mobile" | "hover",
    summary?: string
  ) => void;
  resetNodeStyleKeys: (
    nodeId: string,
    keys: StylePropertyKey[],
    breakpoint: "base" | "tablet" | "mobile" | "hover"
  ) => void;
  toggleNodeVisibility: (nodeId: string) => void;
  toggleNodeLock: (nodeId: string) => void;
  renameNode: (nodeId: string, label: string) => void;

  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;

  startAiPreview: (session: AiPreviewSession) => void;
  applyAiPreview: () => void;
  revertAiPreview: () => void;
  discardAllChanges: (serverNodes: ElementNode[]) => void;
}

function makeHistoryId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  pageId: "",
  pageSlug: "home",
  pageTitle: "Home page",
  seoTitle: "",
  seoDescription: "",
  pageVersion: undefined,
  publishedVersionId: null,
  latestVersionNumber: 1,
  status: "DRAFT",

  nodes: [],
  selectedIds: [],
  hoveredId: null,
  expandedLayerIds: {},

  themeTokens: null,
  themeDirty: false,

  viewport: "desktop",
  zoom: 1,
  showOutlines: true,
  showGrid: false,
  previewMode: false,

  dirty: false,
  saveStatus: "saved",
  saveError: null,
  lastSavedAt: null,

  history: [],
  historyIndex: -1,

  aiPreview: null,

  loadPage: (params) => {
    const firstId = params.nodes[0]?.id;
    const expanded: Record<string, boolean> = {};
    for (const root of params.nodes) {
      expanded[root.id] = true;
    }
    set({
      pageId: params.pageId,
      pageSlug: params.pageSlug,
      pageTitle: params.pageTitle,
      seoTitle: params.seoTitle || "",
      seoDescription: params.seoDescription || "",
      pageVersion: params.pageVersion,
      publishedVersionId: params.publishedVersionId ?? null,
      latestVersionNumber: params.latestVersionNumber ?? 1,
      status: params.status || "DRAFT",
      nodes: params.nodes,
      selectedIds: firstId ? [firstId] : [],
      hoveredId: null,
      expandedLayerIds: expanded,
      dirty: false,
      saveStatus: "saved",
      saveError: null,
      history: [],
      historyIndex: -1,
      aiPreview: null,
    });
  },

  setPageMeta: (meta) =>
    set((s) => ({
      pageTitle: meta.pageTitle ?? s.pageTitle,
      seoTitle: meta.seoTitle ?? s.seoTitle,
      seoDescription: meta.seoDescription ?? s.seoDescription,
      dirty: true,
      saveStatus: "unsaved",
    })),

  markSaved: (params) =>
    set({
      pageVersion: params.pageVersion,
      latestVersionNumber: params.latestVersionNumber,
      publishedVersionId: params.publishedVersionId ?? null,
      status: params.status ?? "DRAFT",
      dirty: false,
      saveStatus: "saved",
      saveError: null,
      lastSavedAt: new Date().toISOString(),
    }),

  setSaveStatus: (saveStatus, error = null) =>
    set({ saveStatus, saveError: error }),

  setThemeTokens: (tokens, markDirty = true) =>
    set((s) => ({
      themeTokens: tokens,
      themeDirty: markDirty ? true : s.themeDirty,
    })),

  markThemeSaved: () => set({ themeDirty: false }),

  selectNode: (id, opts) =>
    set((s) => {
      if (!id) return { selectedIds: [] };
      if (opts?.additive) {
        const exists = s.selectedIds.includes(id);
        const nextIds = exists
          ? s.selectedIds.filter((x) => x !== id)
          : [...s.selectedIds, id];
        return { selectedIds: nextIds };
      }
      return { selectedIds: [id] };
    }),

  setHoveredId: (hoveredId) => set({ hoveredId }),

  toggleLayerExpanded: (id) =>
    set((s) => ({
      expandedLayerIds: {
        ...s.expandedLayerIds,
        [id]: !s.expandedLayerIds[id],
      },
    })),

  expandAncestors: (ids) =>
    set((s) => {
      const next = { ...s.expandedLayerIds };
      for (const id of ids) {
        let cur = findParent(s.nodes, id)?.parent;
        while (cur) {
          next[cur.id] = true;
          cur = findParent(s.nodes, cur.id)?.parent;
        }
      }
      return { expandedLayerIds: next };
    }),

  setViewport: (viewport) => set({ viewport }),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(1.5, zoom)) }),
  setShowOutlines: (showOutlines) => set({ showOutlines }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setPreviewMode: (previewMode) => set({ previewMode }),

  executeOperation: (op, opts) => {
    const state = get();
    const nextNodes = applyOperation(state.nodes, op);
    if (nextNodes === state.nodes) {
      return false;
    }

    const validNextSelected =
      opts?.nextSelectedIds ||
      state.selectedIds.filter((id) => Boolean(findNode(nextNodes, id)));

    const entry: HistoryEntry = {
      id: makeHistoryId(),
      timestamp: new Date().toISOString(),
      source: opts?.source || "manual",
      summary: opts?.summary || `Edit (${op.type.replace("_", " ")})`,
      model: opts?.model,
      beforeNodes: state.nodes,
      afterNodes: nextNodes,
      beforeSelectedIds: state.selectedIds,
      afterSelectedIds: validNextSelected,
    };

    const truncated = state.history.slice(0, state.historyIndex + 1);
    const appended = [...truncated, entry].slice(-MAX_HISTORY);

    set({
      nodes: nextNodes,
      selectedIds: validNextSelected,
      history: appended,
      historyIndex: appended.length - 1,
      dirty: true,
      saveStatus: "unsaved",
      aiPreview: null,
    });
    return true;
  },

  executeBatch: (ops, opts) => {
    const state = get();
    if (!ops.length) return false;
    const nextNodes = applyOperations(state.nodes, ops);
    if (nextNodes === state.nodes) return false;

    const validNextSelected =
      opts.nextSelectedIds ||
      state.selectedIds.filter((id) => Boolean(findNode(nextNodes, id)));

    const entry: HistoryEntry = {
      id: makeHistoryId(),
      timestamp: new Date().toISOString(),
      source: opts.source || "manual",
      summary: opts.summary,
      model: opts.model,
      beforeNodes: state.nodes,
      afterNodes: nextNodes,
      beforeSelectedIds: state.selectedIds,
      afterSelectedIds: validNextSelected,
    };

    const truncated = state.history.slice(0, state.historyIndex + 1);
    const appended = [...truncated, entry].slice(-MAX_HISTORY);

    set({
      nodes: nextNodes,
      selectedIds: validNextSelected,
      history: appended,
      historyIndex: appended.length - 1,
      dirty: true,
      saveStatus: "unsaved",
      aiPreview: null,
    });
    return true;
  },

  insertElement: (type, parentId, index) => {
    const state = get();
    const newNode = createElementNode(type);
    let targetParentId = parentId;

    if (targetParentId === undefined) {
      const activeId = state.selectedIds[0];
      const active = activeId ? findNode(state.nodes, activeId) : null;
      if (active && canAcceptChild(active) && !active.locked) {
        targetParentId = active.id;
      } else if (activeId) {
        const parentInfo = findParent(state.nodes, activeId);
        targetParentId = parentInfo?.parent?.id ?? null;
      } else {
        targetParentId = null;
      }
    }

    if (targetParentId === null && type !== "section" && !canAcceptChild(newNode)) {
      // Wrap loose basic/ecommerce/advanced widgets dropped onto page root inside a clean section container
      const wrapper = createElementNode("section");
      wrapper.label = `${newNode.label} Section`;
      wrapper.children = [newNode];
      const ok = state.executeOperation(
        { type: "insert_node", parentId: null, index, node: wrapper },
        { summary: `Add ${newNode.label}`, nextSelectedIds: [newNode.id] }
      );
      if (ok) {
        get().expandAncestors([newNode.id]);
        return newNode;
      }
      return null;
    }

    const ok = state.executeOperation(
      {
        type: "insert_node",
        parentId: targetParentId ?? null,
        index,
        node: newNode,
      },
      { summary: `Add ${newNode.label}`, nextSelectedIds: [newNode.id] }
    );
    if (ok) {
      get().expandAncestors([newNode.id]);
      return newNode;
    }
    return null;
  },

  duplicateSelected: () => {
    const state = get();
    const ops: EditorOperation[] = [];
    const createdIds: string[] = [];
    for (const id of state.selectedIds) {
      const node = findNode(state.nodes, id);
      if (!node) continue;
      const freshCopy = cloneSubtreeWithFreshIds(node);
      createdIds.push(freshCopy.id);
      ops.push({ type: "duplicate_node", nodeId: id, newNodeId: freshCopy.id });
    }
    if (!ops.length) return;
    state.executeBatch(ops, {
      summary:
        ops.length === 1
          ? `Duplicate element`
          : `Duplicate ${ops.length} elements`,
      nextSelectedIds: createdIds,
    });
  },

  deleteSelected: () => {
    const state = get();
    const deletable = state.selectedIds.filter((id) => {
      const node = findNode(state.nodes, id);
      return node && !node.locked;
    });
    if (!deletable.length) return;
    if (countTreeNodes(state.nodes) <= deletable.length && state.nodes.length <= 1) {
      return;
    }
    state.executeBatch(
      deletable.map((id) => ({ type: "delete_node", nodeId: id })),
      {
        summary:
          deletable.length === 1
            ? `Delete element`
            : `Delete ${deletable.length} elements`,
        nextSelectedIds: [],
      }
    );
  },

  updateNodeProps: (nodeId, props, label) => {
    const node = findNode(get().nodes, nodeId);
    if (!node || node.locked) return;
    get().executeOperation(
      { type: "update_props", nodeId, props },
      { summary: label || `Update ${node.label}` }
    );
  },

  updateNodeStyles: (nodeId, styles, breakpoint = "base", summary) => {
    const node = findNode(get().nodes, nodeId);
    if (!node || node.locked) return;
    get().executeOperation(
      { type: "update_styles", nodeId, breakpoint, styles },
      { summary: summary || `Style ${node.label}` }
    );
  },

  resetNodeStyleKeys: (nodeId, keys, breakpoint) => {
    const node = findNode(get().nodes, nodeId);
    if (!node || node.locked || !keys.length) return;
    get().executeOperation(
      { type: "reset_style_keys", nodeId, breakpoint, keys },
      { summary: `Reset ${breakpoint} styles on ${node.label}` }
    );
  },

  toggleNodeVisibility: (nodeId) => {
    const node = findNode(get().nodes, nodeId);
    if (!node) return;
    get().executeOperation(
      { type: "update_visibility", nodeId, visible: !node.visible },
      { summary: `${node.visible ? "Hide" : "Show"} ${node.label}` }
    );
  },

  toggleNodeLock: (nodeId) => {
    const node = findNode(get().nodes, nodeId);
    if (!node) return;
    get().executeOperation(
      { type: "update_meta", nodeId, locked: !node.locked },
      { summary: `${node.locked ? "Unlock" : "Lock"} ${node.label}` }
    );
  },

  renameNode: (nodeId, label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    get().executeOperation(
      { type: "update_meta", nodeId, label: trimmed },
      { summary: `Rename to "${trimmed}"` }
    );
  },

  undo: () => {
    const state = get();
    if (state.aiPreview) {
      set({ aiPreview: null });
      return;
    }
    if (state.historyIndex < 0) return;
    const entry = state.history[state.historyIndex];
    set({
      nodes: entry.beforeNodes,
      selectedIds: entry.beforeSelectedIds,
      historyIndex: state.historyIndex - 1,
      dirty: true,
      saveStatus: "unsaved",
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const entry = state.history[state.historyIndex + 1];
    set({
      nodes: entry.afterNodes,
      selectedIds: entry.afterSelectedIds,
      historyIndex: state.historyIndex + 1,
      dirty: true,
      saveStatus: "unsaved",
    });
  },

  jumpToHistory: (index) => {
    const state = get();
    if (index < -1 || index >= state.history.length) return;
    if (index === -1) {
      const first = state.history[0];
      if (!first) return;
      set({
        nodes: first.beforeNodes,
        selectedIds: first.beforeSelectedIds,
        historyIndex: -1,
        dirty: true,
        saveStatus: "unsaved",
      });
      return;
    }
    const target = state.history[index];
    set({
      nodes: target.afterNodes,
      selectedIds: target.afterSelectedIds,
      historyIndex: index,
      dirty: true,
      saveStatus: "unsaved",
    });
  },

  startAiPreview: (session) => set({ aiPreview: session }),

  applyAiPreview: () => {
    const state = get();
    const preview = state.aiPreview;
    if (!preview) return;
    const entry: HistoryEntry = {
      id: makeHistoryId(),
      timestamp: new Date().toISOString(),
      source: "ai",
      summary: `AI: ${preview.summary}`,
      model: preview.model,
      beforeNodes: state.nodes,
      afterNodes: preview.previewNodes,
      beforeSelectedIds: state.selectedIds,
      afterSelectedIds: preview.targetNodeIds.filter((id) =>
        Boolean(findNode(preview.previewNodes, id))
      ),
    };
    const truncated = state.history.slice(0, state.historyIndex + 1);
    const appended = [...truncated, entry].slice(-MAX_HISTORY);
    set({
      nodes: preview.previewNodes,
      selectedIds: entry.afterSelectedIds.length
        ? entry.afterSelectedIds
        : state.selectedIds,
      history: appended,
      historyIndex: appended.length - 1,
      dirty: true,
      saveStatus: "unsaved",
      aiPreview: null,
    });
  },

  revertAiPreview: () => set({ aiPreview: null }),

  discardAllChanges: (serverNodes) =>
    set({
      nodes: serverNodes,
      selectedIds: serverNodes[0] ? [serverNodes[0].id] : [],
      dirty: false,
      saveStatus: "saved",
      history: [],
      historyIndex: -1,
      aiPreview: null,
    }),
}));
