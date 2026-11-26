"use client";

import { useDroppable } from "@dnd-kit/core";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { PageRenderer } from "@/features/builder/renderer/PageRenderer";
import { GlobalTypographyStyleTag } from "@/features/typography/GlobalTypographyStyleTag";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { StoreFooter, StoreHeader } from "@/features/storefront/header-footer";
import type { StoreCategoryItem, StoreProductItem } from "@/features/storefront/blocks";
import { themeTokensToCssVars } from "@/lib/cms-schema";
import type { AnimationPresetDefinition } from "@/features/motion/types";
import type { ThemeTokens } from "@/types/api-cms-ai";
import { cn } from "@/lib/format";
const FloatingAiBar = dynamic(
  () => import("./ai/FloatingAiBar").then((m) => m.FloatingAiBar),
  { ssr: false }
);

const GRID_GUIDES_OVERLAY = (
  <div className="ed-grid-guides" aria-hidden="true">
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className="ed-grid-col" />
    ))}
  </div>
);
import {
  CanvasDropSlot,
  CanvasNodeDndShell,
  type DropTargetData,
} from "./dnd/EditorDndProvider";

export function EditorCanvas({
  catalog,
  categories,
  fallbackThemeTokens,
  customPresets = [],
  canUseAi,
  canWrite,
  onNotify,
}: {
  catalog: StoreProductItem[];
  categories: StoreCategoryItem[];
  fallbackThemeTokens?: ThemeTokens | null;
  customPresets?: AnimationPresetDefinition[];
  canUseAi: boolean;
  canWrite: boolean;
  onNotify: (msg: string) => void;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const aiPreview = useEditorStore((s) => s.aiPreview);
  const lastAppliedAiCompare = useEditorStore((s) => s.lastAppliedAiCompare);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedChrome = useEditorStore((s) => s.selectedChrome);
  const hoveredId = useEditorStore((s) => s.hoveredId);
  const selectedPart = useEditorStore((s) => s.selectedPart);
  const hoveredPart = useEditorStore((s) => s.hoveredPart);
  const themeTokens = useEditorStore((s) => s.themeTokens);
  const viewport = useEditorStore((s) => s.viewport);
  const zoom = useEditorStore((s) => s.zoom);
  const showOutlines = useEditorStore((s) => s.showOutlines);
  const showGrid = useEditorStore((s) => s.showGrid);
  const previewMode = useEditorStore((s) => s.previewMode);
  const motionReplayNonceByNodeId = useEditorStore((s) => s.motionReplayNonceByNodeId);
  const motionPausedNodeIds = useEditorStore((s) => s.motionPausedNodeIds);
  const motionScrollProgressByNodeId = useEditorStore((s) => s.motionScrollProgressByNodeId);
  const aiBarOpen = useEditorStore((s) => s.aiBarOpen);

  const selectNode = useEditorStore((s) => s.selectNode);
  const selectChrome = useEditorStore((s) => s.selectChrome);
  const selectPart = useEditorStore((s) => s.selectPart);
  const setHoveredId = useEditorStore((s) => s.setHoveredId);
  const setHoveredPart = useEditorStore((s) => s.setHoveredPart);

  const viewingBeforePreview = Boolean(aiPreview && aiPreview.viewMode === "before");
  const viewingBeforeApplied = Boolean(
    !aiPreview && lastAppliedAiCompare?.viewingBefore
  );
  const viewingBefore = viewingBeforePreview || viewingBeforeApplied;

  const renderedNodes = aiPreview
    ? viewingBeforePreview
      ? aiPreview.beforeNodes
      : aiPreview.previewNodes
    : viewingBeforeApplied && lastAppliedAiCompare
      ? lastAppliedAiCompare.beforeNodes
      : nodes;

  const baseThemeTokens = themeTokens || fallbackThemeTokens || null;
  const activeThemeTokens = aiPreview
    ? (viewingBeforePreview ? aiPreview.beforeThemeTokens : aiPreview.previewThemeTokens) ||
      baseThemeTokens
    : viewingBeforeApplied && lastAppliedAiCompare
      ? lastAppliedAiCompare.beforeThemeTokens || baseThemeTokens
      : baseThemeTokens;
  const aiAffectedIds = useMemo(
    () =>
      aiPreview && !viewingBeforePreview
        ? new Set(aiPreview.diffs.map((d) => d.nodeId))
        : undefined,
    [aiPreview, viewingBeforePreview]
  );

  const themeCssVars = useMemo(
    () => themeTokensToCssVars(activeThemeTokens),
    [activeThemeTokens]
  );

  const { setNodeRef: setEmptyRootDropRef, isOver: isRootEmptyOver } =
    useDroppable({
      id: "canvas-root-empty",
      data: {
        zone: "slot",
        parentId: null,
        index: 0,
      } satisfies DropTargetData,
      disabled: renderedNodes.length > 0,
    });

  const frameWidth =
    viewport === "mobile"
      ? "390px"
      : viewport === "tablet"
        ? "768px"
        : "100%";

  return (
    <main className={cn("ed-canvas-stage", previewMode && "is-preview")}>
      {viewingBefore && !previewMode ? (
        <div className="ed-canvas-before-badge" role="status">
          Viewing Before AI (original state)
        </div>
      ) : null}
      <div
        className={cn("ed-canvas-scroll", !aiBarOpen && "ed-ai-hidden")}
        onClick={() => {
          if (!previewMode) { selectNode(null); selectChrome(null); }
        }}
      >
        <div
          className={cn(
            "ed-artboard-frame",
            `vp-${viewport}`,
            previewMode && "is-preview"
          )}
          style={{
            width: frameWidth,
            maxWidth: viewport === "desktop" ? (previewMode ? "none" : "1320px") : frameWidth,
            zoom: zoom === 1 ? undefined : zoom,
          }}
        >
          {showGrid && !previewMode ? GRID_GUIDES_OVERLAY : null}

          <div
            className="store public-store ed-store-surface"
            style={themeCssVars}
          >
            <GlobalTypographyStyleTag
              typography={activeThemeTokens?.typography}
              scopeId="editor-canvas"
              scopeSelector=".ed-store-surface"
              forceViewport={viewport}
            />
            <div
              className={
                previewMode
                  ? undefined
                  : cn(
                      "ed-chrome-editable",
                      selectedChrome === "header" && "is-selected"
                    )
              }
              onClick={
                previewMode
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      selectChrome("header");
                    }
              }
            >
              {!previewMode ? (
                <span className="ed-chrome-badge">Site Header</span>
              ) : null}
              <StoreHeader
                preview
                cart={0}
                wishlistCount={0}
                currentPath="/store"
                headerConfig={activeThemeTokens?.header}
              />
            </div>

            {renderedNodes.length === 0 && !previewMode ? (
              <div
                ref={setEmptyRootDropRef}
                className={cn(
                  "ed-empty-canvas-drop",
                  isRootEmptyOver && "is-over"
                )}
              >
                <strong>Blank canvas</strong>
                <p className="muted">
                  Drag a Section, Grid, Heading, or Product Grid from the Left Sidebar to start building.
                </p>
              </div>
            ) : (
              <PageRenderer
                nodes={renderedNodes}
                typography={activeThemeTokens?.typography}
                globalMotion={activeThemeTokens?.motion}
                customPresets={customPresets}
                motionReplayNonceByNodeId={motionReplayNonceByNodeId}
                motionPausedNodeIds={motionPausedNodeIds}
                motionScrollProgressByNodeId={motionScrollProgressByNodeId}
                mode={previewMode ? "live" : "edit"}
                viewport={viewport}
                forceViewport={previewMode ? viewport : undefined}
                showOutlines={showOutlines}
                selectedIds={selectedIds}
                hoveredId={hoveredId}
                selectedPart={selectedPart}
                hoveredPart={hoveredPart}
                aiAffectedIds={aiAffectedIds}
                catalog={catalog}
                categories={categories}
                onSelectNode={(nodeId, opts) => selectNode(nodeId, opts)}
                onSelectPart={(nodeId, partKey) => selectPart(nodeId, partKey)}
                onHoverNode={(nodeId) => setHoveredId(nodeId)}
                onHoverPart={(part) => setHoveredPart(part)}
                onNotify={onNotify}
                wrapEditNode={
                  previewMode
                    ? undefined
                    : ({ node, parentId, index, isSelected, wrapperStyle, children }) => (
                        <CanvasNodeDndShell
                          node={node}
                          parentId={parentId}
                          index={index}
                          isSelected={isSelected}
                          wrapperStyle={wrapperStyle}
                        >
                          {children}
                        </CanvasNodeDndShell>
                      )
                }
                renderContainerEndSlot={
                  previewMode
                    ? undefined
                    : (parentId, childCount) => (
                        <CanvasDropSlot
                          id={`slot-end-${parentId ?? "root"}`}
                          parentId={parentId}
                          index={childCount}
                          isRoot={parentId === null}
                        />
                      )
                }
              />
            )}

            <div
              className={
                previewMode
                  ? undefined
                  : cn(
                      "ed-chrome-editable",
                      selectedChrome === "footer" && "is-selected"
                    )
              }
              onClick={
                previewMode
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      selectChrome("footer");
                    }
              }
            >
              {!previewMode ? (
                <span className="ed-chrome-badge">Site Footer</span>
              ) : null}
              <StoreFooter
                preview
                footerConfig={activeThemeTokens?.footer}
                onNotify={onNotify}
              />
            </div>
          </div>
        </div>
      </div>

      {!previewMode && canUseAi ? (
        <FloatingAiBar
          canUseAi={canUseAi}
          canWrite={canWrite}
          onNotify={onNotify}
        />
      ) : null}
    </main>
  );
}
