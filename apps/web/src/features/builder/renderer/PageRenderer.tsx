"use client";

import { Lock, EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import type { StoreCategoryItem, StoreProductItem } from "@/features/storefront/blocks";
import { cn } from "@/lib/format";
import { renderElementContent } from "../registry/elements";
import {
  compileLivePageCss,
  compileNodeInlineStyle,
  isVisibleForViewport,
} from "../style-compiler";
import type { ElementNode, ViewportMode } from "../types";

export type EditNodeWrapperProps = {
  node: ElementNode;
  parentId: string | null;
  index: number;
  depth: number;
  isSelected: boolean;
  isHovered: boolean;
  isAiPreviewAffected: boolean;
  children: ReactNode;
};

export function PageRenderer({
  nodes,
  mode,
  viewport = "desktop",
  showOutlines = false,
  selectedIds = [],
  hoveredId = null,
  aiAffectedIds,
  catalog = [],
  categories = [],
  onSelectNode,
  onHoverNode,
  onAddToCart,
  onNotify,
  wrapEditNode,
  renderContainerEndSlot,
}: {
  nodes: ElementNode[];
  mode: "edit" | "live";
  viewport?: ViewportMode;
  showOutlines?: boolean;
  selectedIds?: string[];
  hoveredId?: string | null;
  aiAffectedIds?: Set<string>;
  catalog?: StoreProductItem[];
  categories?: StoreCategoryItem[];
  onSelectNode?: (nodeId: string, opts?: { additive?: boolean }) => void;
  onHoverNode?: (nodeId: string | null) => void;
  onAddToCart?: (product: StoreProductItem) => void;
  onNotify?: (msg: string) => void;
  wrapEditNode?: (args: EditNodeWrapperProps) => ReactNode;
  renderContainerEndSlot?: (parentId: string | null, childCount: number) => ReactNode;
}) {
  const liveCss = mode === "live" ? compileLivePageCss(nodes) : "";
  const selectedSet = new Set(selectedIds);

  const renderNodeList = (
    list: ElementNode[],
    parentId: string | null,
    depth: number
  ): ReactNode => (
    <>
      {list.map((node, index) => {
        if (mode === "live") {
          if (!node.visible) return null;
          const inner = renderElementContent(
            node,
            {
              mode: "live",
              viewport: "desktop",
              catalog,
              categories,
              onAddToCart,
              onNotify,
              renderChildren: (containerNode) =>
                containerNode.children?.length
                  ? renderNodeList(containerNode.children, containerNode.id, depth + 1)
                  : null,
            },
            {}
          );

          return (
            <div
              key={node.id}
              data-builder-node={node.id}
              data-builder-type={node.type}
              className={cn("bldr-live-node", node.customCssClasses?.join(" "))}
              {...(node.htmlAttributes || {})}
            >
              {inner}
            </div>
          );
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

        const elementBody = renderElementContent(
          node,
          {
            mode: "edit",
            viewport,
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
          compiledStyle
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
            }}
            onMouseOut={(e) => {
              e.stopPropagation();
              if (hoveredId === node.id) onHoverNode?.(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode?.(node.id, {
                additive: e.shiftKey || e.metaKey || e.ctrlKey,
              });
            }}
          >
            {isHovered || isSelected || isAiAffected ? (
              <div
                className={cn(
                  "bldr-node-tag",
                  isSelected && "selected",
                  isAiAffected && "ai"
                )}
              >
                <span>{node.label}</span>
                {node.locked ? <Lock size={10} /> : null}
                {!visibleInViewport ? <EyeOff size={10} /> : null}
                {isAiAffected ? <em>AI preview</em> : null}
              </div>
            ) : null}
            {elementBody}
          </div>
        );

        if (wrapEditNode) {
          return (
            <div key={node.id}>
              {wrapEditNode({
                node,
                parentId,
                index,
                depth,
                isSelected,
                isHovered,
                isAiPreviewAffected: isAiAffected,
                children: interactiveBox,
              })}
            </div>
          );
        }

        return <div key={node.id}>{interactiveBox}</div>;
      })}
      {mode === "edit" && renderContainerEndSlot
        ? renderContainerEndSlot(parentId, list.length)
        : null}
    </>
  );

  return (
    <div className={cn("bldr-page-root", mode === "edit" ? "is-edit" : "is-live")}>
      {liveCss ? <style>{liveCss}</style> : null}
      {renderNodeList(nodes, null, 0)}
    </div>
  );
}
