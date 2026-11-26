"use client";

import { EyeOff, Lock } from "lucide-react";
import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import type { StoreCategoryItem, StoreProductItem } from "@/features/storefront/blocks";
import { cn } from "@/lib/format";
import { getElementPart } from "../parts";
import { renderElementContent, type BuilderNodeAttrs } from "../registry/elements";
import { sanitizeHtmlAttributes } from "../sanitizers";
import {
  compileEditHighlightCss,
  compileEditPartCss,
  compileLivePageCss,
  compileNodeInlineStyle,
  isVisibleForViewport,
  splitEditWrapperStyles,
} from "../style-compiler";
import { MotionWrapper } from "@/features/motion/MotionWrapper";
import { hasAnyActiveMotion } from "@/features/motion/resolve";
import type {
  AnimationPresetDefinition,
  GlobalMotionSettings,
  NormalizedGlobalMotion,
} from "@/features/motion/types";
import { normalizeGlobalTypography } from "@/features/typography/defaults";
import { getEffectivePresetId } from "@/features/typography/resolve";
import type { GlobalTypographyTokens, NormalizedGlobalTypography } from "@/features/typography/types";
import type { ElementNode, ViewportMode } from "../types";

function resolveOwnPartKey(
  target: EventTarget | null,
  containerEl: HTMLElement,
  nodeType: ElementNode["type"]
): string | null {
  if (!(target instanceof Element)) return null;
  const partEl = target.closest<HTMLElement>("[data-builder-part]");
  if (!partEl) return null;
  if (partEl.closest("[data-editor-node-id]") !== containerEl) return null;
  const partKey = partEl.getAttribute("data-builder-part");
  return partKey && getElementPart(nodeType, partKey) ? partKey : null;
}

export type EditNodeWrapperProps = {
  node: ElementNode;
  parentId: string | null;
  index: number;
  depth: number;
  isSelected: boolean;
  isHovered: boolean;
  isAiPreviewAffected: boolean;
  wrapperStyle?: CSSProperties;
  children: ReactNode;
};

export function PageRenderer({
  nodes,
  mode,
  viewport = "desktop",
  forceViewport,
  showOutlines = false,
  selectedIds = [],
  hoveredId = null,
  selectedPart = null,
  hoveredPart = null,
  aiAffectedIds,
  typography,
  globalMotion,
  customPresets = [],
  motionReplayNonceByNodeId,
  motionPausedNodeIds,
  motionScrollProgressByNodeId,
  catalog = [],
  categories = [],
  onSelectNode,
  onSelectPart,
  onHoverNode,
  onHoverPart,
  onAddToCart,
  onNotify,
  wrapEditNode,
  renderContainerEndSlot,
}: {
  nodes: ElementNode[];
  mode: "edit" | "live";
  viewport?: ViewportMode;
  forceViewport?: ViewportMode;
  showOutlines?: boolean;
  selectedIds?: string[];
  hoveredId?: string | null;
  selectedPart?: { nodeId: string; partKey: string } | null;
  hoveredPart?: { nodeId: string; partKey: string } | null;
  aiAffectedIds?: Set<string>;
  typography?: GlobalTypographyTokens | NormalizedGlobalTypography | null;
  globalMotion?: GlobalMotionSettings | NormalizedGlobalMotion | null;
  customPresets?: AnimationPresetDefinition[];
  motionReplayNonceByNodeId?: Record<string, number>;
  motionPausedNodeIds?: Record<string, boolean>;
  motionScrollProgressByNodeId?: Record<string, number | null>;
  catalog?: StoreProductItem[];
  categories?: StoreCategoryItem[];
  onSelectNode?: (nodeId: string, opts?: { additive?: boolean }) => void;
  onSelectPart?: (nodeId: string, partKey: string | null) => void;
  onHoverNode?: (nodeId: string | null) => void;
  onHoverPart?: (part: { nodeId: string; partKey: string } | null) => void;
  onAddToCart?: (product: StoreProductItem) => void;
  onNotify?: (msg: string) => void;
  wrapEditNode?: (args: EditNodeWrapperProps) => ReactNode;
  renderContainerEndSlot?: (parentId: string | null, childCount: number) => ReactNode;
}) {
  const baseStyleCss = useMemo(
    () =>
      mode === "live"
        ? compileLivePageCss(nodes, {
            hoverOnly: Boolean(forceViewport),
            forceViewport,
          })
        : compileEditPartCss(nodes, viewport),
    [mode, nodes, forceViewport, viewport]
  );
  const highlightCss = useMemo(
    () =>
      mode === "edit"
        ? compileEditHighlightCss({ selectedPart, hoveredPart })
        : "",
    [mode, selectedPart, hoveredPart]
  );
  const styleCss = highlightCss
    ? baseStyleCss
      ? `${baseStyleCss}\n${highlightCss}`
      : highlightCss
    : baseStyleCss;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedTypo = useMemo(
    () => (typography ? normalizeGlobalTypography(typography) : null),
    [typography]
  );

  const renderNodeList = (
    list: ElementNode[],
    parentId: string | null,
    depth: number
  ): ReactNode => (
    <>
      {list.map((node, index) => {
        const sanitizedAttrs = sanitizeHtmlAttributes(node.htmlAttributes);
        const customClass = node.customCssClasses?.join(" ");

        if (mode === "live") {
          if (forceViewport) {
            if (!isVisibleForViewport(node.visible, node.visibility, forceViewport)) {
              return null;
            }
          } else if (!node.visible) {
            return null;
          }

          const liveInlineStyle = forceViewport
            ? compileNodeInlineStyle(node.styles, forceViewport)
            : {};

          const effectivePreset = getEffectivePresetId(node, normalizedTypo?.presets);
          const nodeAttrs: BuilderNodeAttrs = {
            ...sanitizedAttrs,
            "data-builder-node": node.id,
            "data-builder-type": node.type,
            ...(effectivePreset ? { "data-typography-preset": effectivePreset } : {}),
            ...(customClass ? { className: customClass } : {}),
          };

          const inner = renderElementContent(
            node,
            {
              mode: "live",
              viewport: forceViewport || "desktop",
              globalMotion,
              customPresets,
              motionReplayNonceByNodeId,
              catalog,
              categories,
              onAddToCart,
              onNotify,
              renderChildren: (containerNode) =>
                containerNode.children?.length
                  ? renderNodeList(containerNode.children, containerNode.id, depth + 1)
                  : null,
            },
            liveInlineStyle,
            nodeAttrs
          );

          if (hasAnyActiveMotion(node.motion)) {
            return (
              <MotionWrapper
                key={node.id}
                nodeId={node.id}
                nodeType={node.type}
                motion={node.motion}
                viewport={forceViewport || "desktop"}
                mode="live"
                globalMotion={globalMotion}
                customPresets={customPresets}
              >
                {inner}
              </MotionWrapper>
            );
          }

          return <Fragment key={node.id}>{inner}</Fragment>;
        }

        const visibleInViewport = isVisibleForViewport(
          node.visible,
          node.visibility,
          viewport
        );
        const isSelected = selectedSet.has(node.id);
        const isHovered = hoveredId === node.id;
        const isAiAffected = Boolean(aiAffectedIds?.has(node.id));
        const compiledStyle = compileNodeInlineStyle(node.styles, viewport);
        const { wrapperStyle, elementStyle } = splitEditWrapperStyles(
          compiledStyle,
          node.type
        );

        const editEffectivePreset = getEffectivePresetId(node, normalizedTypo?.presets);
        const editNodeAttrs: BuilderNodeAttrs = {
          ...sanitizedAttrs,
          ...(editEffectivePreset ? { "data-typography-preset": editEffectivePreset } : {}),
          ...(customClass ? { className: customClass } : {}),
        };

        const elementBody = renderElementContent(
          node,
          {
            mode: "edit",
            viewport,
            globalMotion,
            customPresets,
            motionReplayNonceByNodeId,
            catalog,
            categories,
            onAddToCart,
            onNotify,
            renderChildren: (containerNode) =>
              renderNodeList(
                containerNode.children || [],
                containerNode.id,
                depth + 1
              ),
          },
          elementStyle,
          editNodeAttrs
        );

        const interactiveBox = (
          <div
            data-editor-node-id={node.id}
            data-editor-node-type={node.type}
            className={cn(
              "bldr-edit-node",
              showOutlines && "show-outlines",
              isHovered && !isSelected && "is-hovered",
              isSelected && "is-selected",
              !visibleInViewport && "is-hidden-node",
              node.locked && "is-locked-node",
              isAiAffected && "is-ai-preview"
            )}
            onMouseOver={(e) => {
              e.stopPropagation();
              onHoverNode?.(node.id);
              if (onHoverPart) {
                const pk = resolveOwnPartKey(
                  e.target,
                  e.currentTarget,
                  node.type
                );
                onHoverPart(pk ? { nodeId: node.id, partKey: pk } : null);
              }
            }}
            onMouseOut={(e) => {
              e.stopPropagation();
              if (hoveredId === node.id) {
                onHoverNode?.(null);
                onHoverPart?.(null);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              const additive = e.shiftKey || e.metaKey || e.ctrlKey;
              if (!additive && onSelectPart) {
                const pk = resolveOwnPartKey(
                  e.target,
                  e.currentTarget,
                  node.type
                );
                onSelectPart(node.id, pk);
                return;
              }
              onSelectNode?.(node.id, { additive });
            }}
          >
            {(() => {
              const activePartKey =
                selectedPart?.nodeId === node.id
                  ? selectedPart.partKey
                  : hoveredPart?.nodeId === node.id
                    ? hoveredPart.partKey
                    : null;
              const activePartDef = getElementPart(node.type, activePartKey);
              return isHovered || isSelected || isAiAffected ? (
                <div
                  className={cn(
                    "bldr-node-tag",
                    isSelected && "selected",
                    isAiAffected && "ai"
                  )}
                >
                  <span>
                    {node.label}
                    {activePartDef ? ` › ${activePartDef.label}` : ""}
                  </span>
                  {node.locked ? <Lock size={10} /> : null}
                  {!visibleInViewport ? <EyeOff size={10} /> : null}
                  {activePartDef?.repeating ? <em>Syncs all</em> : null}
                  {isAiAffected ? <em>AI preview</em> : null}
                </div>
              ) : null;
            })()}
            {hasAnyActiveMotion(node.motion) ? (
              <MotionWrapper
                nodeId={node.id}
                nodeType={node.type}
                motion={node.motion}
                viewport={viewport}
                mode="edit"
                globalMotion={globalMotion}
                customPresets={customPresets}
                replayNonce={motionReplayNonceByNodeId?.[node.id] || 0}
                paused={Boolean(motionPausedNodeIds?.[node.id])}
                scrollProgressOverride={motionScrollProgressByNodeId?.[node.id] ?? null}
              >
                {elementBody}
              </MotionWrapper>
            ) : (
              elementBody
            )}
          </div>
        );

        if (wrapEditNode) {
          return (
            <Fragment key={node.id}>
              {wrapEditNode({
                node,
                parentId,
                index,
                depth,
                isSelected,
                isHovered,
                isAiPreviewAffected: isAiAffected,
                wrapperStyle,
                children: interactiveBox,
              })}
            </Fragment>
          );
        }

        return (
          <div
            key={node.id}
            className={cn(
              "bldr-edit-wrap",
              wrapperStyle.height === "100%" && "is-fill-height"
            )}
            style={wrapperStyle}
          >
            {interactiveBox}
          </div>
        );
      })}
      {mode === "edit" && renderContainerEndSlot
        ? renderContainerEndSlot(parentId, list.length)
        : null}
    </>
  );

  return (
    <div className={cn("bldr-page-root", mode === "edit" ? "is-edit" : "is-live")}>
      {styleCss ? <style>{styleCss}</style> : null}
      {renderNodeList(nodes, null, 0)}
    </div>
  );
}
