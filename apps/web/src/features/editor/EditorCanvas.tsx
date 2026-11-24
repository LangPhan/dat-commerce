"use client";

import { useDroppable } from "@dnd-kit/core";
import { PageRenderer } from "@/features/builder/renderer/PageRenderer";
import { GlobalTypographyStyleTag } from "@/features/typography/GlobalTypographyStyleTag";
import { useEditorStore } from "@/features/builder/store/editor-store";
import { StoreFooter, StoreHeader } from "@/features/storefront/header-footer";
import type { StoreCategoryItem, StoreProductItem } from "@/features/storefront/blocks";
import { themeTokensToCssVars } from "@/lib/cms-schema";
import { cn } from "@/lib/format";
import { FloatingAiBar } from "./ai/FloatingAiBar";
import {
  CanvasDropSlot,
  CanvasNodeDndShell,
  type DropTargetData,
} from "./dnd/EditorDndProvider";

export function EditorCanvas({
  catalog,
  categories,
  canUseAi,
  canWrite,
  onNotify,
}: {
  catalog: StoreProductItem[];
  categories: StoreCategoryItem[];
  canUseAi: boolean;
  canWrite: boolean;
  onNotify: (msg: string) => void;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const aiPreview = useEditorStore((s) => s.aiPreview);
  const lastAppliedAiCompare = useEditorStore((s) => s.lastAppliedAiCompare);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredId = useEditorStore((s) => s.hoveredId);
  const selectedPart = useEditorStore((s) => s.selectedPart);
  const hoveredPart = useEditorStore((s) => s.hoveredPart);
  const themeTokens = useEditorStore((s) => s.themeTokens);
  const viewport = useEditorStore((s) => s.viewport);
  const zoom = useEditorStore((s) => s.zoom);
  const showOutlines = useEditorStore((s) => s.showOutlines);
  const showGrid = useEditorStore((s) => s.showGrid);
  const previewMode = useEditorStore((s) => s.previewMode);
  const aiBarOpen = useEditorStore((s) => s.aiBarOpen);

  const selectNode = useEditorStore((s) => s.selectNode);
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

  const activeThemeTokens = aiPreview
    ? (viewingBeforePreview ? aiPreview.beforeThemeTokens : aiPreview.previewThemeTokens) ||
      themeTokens
    : viewingBeforeApplied && lastAppliedAiCompare
      ? lastAppliedAiCompare.beforeThemeTokens || themeTokens
      : themeTokens;
  const aiAffectedIds =
    aiPreview && !viewingBeforePreview
      ? new Set(aiPreview.diffs.map((d) => d.nodeId))
      : undefined;

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
          if (!previewMode) selectNode(null);
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
          {showGrid && !previewMode ? (
            <div className="ed-grid-guides" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="ed-grid-col" />
              ))}
            </div>
          ) : null}

          <div
            className="store public-store ed-store-surface"
            style={themeTokensToCssVars(activeThemeTokens)}
          >
            <GlobalTypographyStyleTag
              typography={activeThemeTokens?.typography}
              scopeId="editor-canvas"
              scopeSelector=".ed-store-surface"
              forceViewport={viewport}
            />
            <div className={previewMode ? undefined : "ed-chrome-muted"}>
              <StoreHeader
                cart={0}
                wishlistCount={0}
                currentPath="/store"
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
                    : ({ node, parentId, index, isSelected, children }) => (
                        <CanvasNodeDndShell
                          node={node}
                          parentId={parentId}
                          index={index}
                          isSelected={isSelected}
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

            <div className={previewMode ? undefined : "ed-chrome-muted"}>
              <StoreFooter />
            </div>
          </div>
        </div>
      </div>

      {!previewMode ? (
        <FloatingAiBar
          canUseAi={canUseAi}
          canWrite={canWrite}
          onNotify={onNotify}
        />
      ) : null}
    </main>
  );
}
