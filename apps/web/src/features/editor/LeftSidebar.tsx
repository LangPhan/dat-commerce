"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  AppWindow,
  BadgeDollarSign,
  Box,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Code2,
  Columns2,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  FolderTree,
  GalleryHorizontal,
  GalleryHorizontalEnd,
  Grid3X3,
  GripVertical,
  Heading,
  History,
  Image as ImageIcon,
  Images,
  Info,
  Layers,
  LayoutGrid,
  ListChecks,
  Lock,
  Megaphone,
  Minus,
  MousePointerClick,
  MoveVertical,
  Package,
  PanelTop,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  SquareStack,
  Star,
  Timer,
  Trash2,
  Type,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { isContainerType } from "@/features/builder/operations";
import {
  ELEMENT_DEFINITIONS,
  PALETTE_ELEMENT_TYPES,
} from "@/features/builder/registry/definitions";
import { useEditorStore } from "@/features/builder/store/editor-store";
import type { ElementCategory, ElementNode } from "@/features/builder/types";
import { cn } from "@/lib/format";
import {
  PaletteDraggableItem,
  type DragPayload,
  type DropTargetData,
} from "./dnd/EditorDndProvider";

const ICON_MAP: Record<string, LucideIcon> = {
  AppWindow,
  BadgeDollarSign,
  Box,
  ChevronsUpDown,
  ClipboardList,
  Code2,
  Columns2,
  Columns3,
  FolderTree,
  GalleryHorizontal,
  GalleryHorizontalEnd,
  Grid3X3,
  Heading,
  Image: ImageIcon,
  Images,
  Info,
  LayoutGrid,
  ListChecks,
  Megaphone,
  Minus,
  MousePointerClick,
  MoveVertical,
  Package,
  PanelTop,
  PlayCircle,
  ShoppingBag,
  Sparkles,
  SquareStack,
  Star,
  Timer,
  Type,
};

const CATEGORY_ORDER: { key: ElementCategory; label: string }[] = [
  { key: "layout", label: "Layout" },
  { key: "basic", label: "Basic Elements" },
  { key: "ecommerce", label: "Ecommerce Elements" },
  { key: "advanced", label: "Advanced" },
];

type LeftTab = "elements" | "layers" | "history";

const LayerTreeRow = memo(function LayerTreeRow({
  node,
  parentId,
  index,
  depth,
}: {
  node: ElementNode;
  parentId: string | null;
  index: number;
  depth: number;
}) {
  const isSelected = useEditorStore((s) => s.selectedIds.includes(node.id));
  const isHovered = useEditorStore((s) => s.hoveredId === node.id);
  const expanded = useEditorStore((s) => s.expandedLayerIds[node.id] ?? true);
  const isOnlyRoot = useEditorStore((s) => depth === 0 && s.nodes.length <= 1);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setHoveredId = useEditorStore((s) => s.setHoveredId);
  const toggleLayerExpanded = useEditorStore((s) => s.toggleLayerExpanded);
  const toggleNodeVisibility = useEditorStore((s) => s.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((s) => s.toggleNodeLock);
  const renameNode = useEditorStore((s) => s.renameNode);
  const executeOperation = useEditorStore((s) => s.executeOperation);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(node.label);

  const isContainer = isContainerType(node.type);
  const hasChildren = Boolean(node.children && node.children.length > 0);

  const def = ELEMENT_DEFINITIONS[node.type];
  const IconComp = ICON_MAP[def?.iconName || "Box"] || Box;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `layer-drag-${node.id}`,
    data: {
      kind: "layer",
      nodeId: node.id,
      elementType: node.type,
      label: node.label,
    } satisfies DragPayload,
    disabled: node.locked,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `layer-drop-${node.id}`,
    data: {
      zone: "layer",
      nodeId: node.id,
      parentId,
      index,
      isContainer,
    } satisfies DropTargetData,
  });

  const commitRename = () => {
    setEditing(false);
    if (draftName.trim() && draftName.trim() !== node.label) {
      renameNode(node.id, draftName);
    } else {
      setDraftName(node.label);
    }
  };

  return (
    <div className="ed-layer-branch">
      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        className={cn(
          "ed-layer-row",
          isSelected && "is-selected",
          isHovered && !isSelected && "is-hovered",
          !node.visible && "is-hidden",
          isOver && "is-drop-over",
          isDragging && "is-dragging"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onMouseEnter={() => setHoveredId(node.id)}
        onMouseLeave={() => {
          if (useEditorStore.getState().hoveredId === node.id) setHoveredId(null);
        }}
        onClick={(e) => {
          selectNode(node.id, {
            additive: e.shiftKey || e.metaKey || e.ctrlKey,
          });
        }}
      >
        <button
          type="button"
          className="ed-layer-expand"
          aria-label={expanded ? "Collapse layer" : "Expand layer"}
          disabled={!isContainer}
          onClick={(e) => {
            e.stopPropagation();
            if (isContainer) toggleLayerExpanded(node.id);
          }}
        >
          {isContainer && hasChildren ? (
            expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : (
            <span style={{ width: 12 }} />
          )}
        </button>

        {!node.locked ? (
          <span
            className="ed-layer-drag"
            aria-label={`Drag ${node.label}`}
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={11} />
          </span>
        ) : null}

        <IconComp size={13} className="ed-layer-icon" />

        {editing ? (
          <input
            autoFocus
            className="ed-layer-rename-input"
            value={draftName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setEditing(false);
                setDraftName(node.label);
              }
            }}
          />
        ) : (
          <span
            className="ed-layer-label"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraftName(node.label);
              setEditing(true);
            }}
            title={`${node.label} (${def?.label || node.type})`}
          >
            {node.label}
          </span>
        )}

        <div className="ed-layer-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Rename"
            aria-label={`Rename ${node.label}`}
            onClick={() => {
              setDraftName(node.label);
              setEditing(true);
            }}
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            title={node.visible ? "Hide element" : "Show element"}
            aria-label={node.visible ? `Hide ${node.label}` : `Show ${node.label}`}
            onClick={() => toggleNodeVisibility(node.id)}
          >
            {node.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <button
            type="button"
            title={node.locked ? "Unlock element" : "Lock element"}
            aria-label={node.locked ? `Unlock ${node.label}` : `Lock ${node.label}`}
            onClick={() => toggleNodeLock(node.id)}
          >
            {node.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>
          <button
            type="button"
            title="Duplicate"
            aria-label={`Duplicate ${node.label}`}
            disabled={node.locked}
            onClick={() =>
              executeOperation(
                { type: "duplicate_node", nodeId: node.id },
                { summary: `Duplicate ${node.label}` }
              )
            }
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            title="Delete"
            aria-label={`Delete ${node.label}`}
            disabled={node.locked || isOnlyRoot}
            onClick={() =>
              executeOperation(
                { type: "delete_node", nodeId: node.id },
                { summary: `Delete ${node.label}`, nextSelectedIds: [] }
              )
            }
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {isContainer && expanded && node.children?.length ? (
        <div className="ed-layer-children">
          {node.children.map((child, childIdx) => (
            <LayerTreeRow
              key={child.id}
              node={child}
              parentId={node.id}
              index={childIdx}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});

export function LeftSidebar() {
  const [tab, setTab] = useState<LeftTab>("elements");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ElementCategory | "all">("all");

  const nodes = useEditorStore((s) => s.nodes);
  const selectedChrome = useEditorStore((s) => s.selectedChrome);
  const selectChrome = useEditorStore((s) => s.selectChrome);
  const pageTitle = useEditorStore((s) => s.pageTitle);
  const insertElement = useEditorStore((s) => s.insertElement);
  const history = useEditorStore((s) => s.history);
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const jumpToHistory = useEditorStore((s) => s.jumpToHistory);

  const groupedElements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORY_ORDER.filter(
      (c) => activeCategory === "all" || c.key === activeCategory
    )
      .map((cat) => {
        const items = PALETTE_ELEMENT_TYPES.map((type) => ELEMENT_DEFINITIONS[type]).filter(
          (def) => {
            if (def.category !== cat.key) return false;
            if (!q) return true;
            return (
              def.label.toLowerCase().includes(q) ||
              def.description.toLowerCase().includes(q) ||
              def.type.toLowerCase().includes(q)
            );
          }
        );
        return { ...cat, items };
      })
      .filter((group) => group.items.length > 0);
  }, [activeCategory, search]);

  return (
    <aside className="ed-left-sidebar" aria-label="Elements and Layers">
      <div className="ed-sidebar-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "elements"}
          className={cn("ed-sidebar-tab", tab === "elements" && "active")}
          onClick={() => setTab("elements")}
        >
          <Plus size={13} />
          <span>Elements</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "layers"}
          className={cn("ed-sidebar-tab", tab === "layers" && "active")}
          onClick={() => setTab("layers")}
        >
          <Layers size={13} />
          <span>Layers</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={cn("ed-sidebar-tab", tab === "history" && "active")}
          onClick={() => setTab("history")}
        >
          <History size={13} />
          <span>History</span>
        </button>
      </div>

      {tab === "elements" ? (
        <div className="ed-sidebar-panel">
          <div className="ed-palette-controls">
            <label className="ed-search-box">
              <Search size={13} />
              <input
                aria-label="Search elements"
                placeholder="Search 30+ elements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="ed-cat-chips">
              <button
                type="button"
                className={cn("ed-cat-chip", activeCategory === "all" && "active")}
                onClick={() => setActiveCategory("all")}
              >
                All
              </button>
              {CATEGORY_ORDER.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={cn(
                    "ed-cat-chip",
                    activeCategory === c.key && "active"
                  )}
                  onClick={() => setActiveCategory(c.key)}
                >
                  {c.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="ed-sidebar-scroll">
            {groupedElements.length === 0 ? (
              <p className="muted" style={{ padding: 14, fontSize: 12.5 }}>
                No elements match &ldquo;{search}&rdquo;.
              </p>
            ) : (
              groupedElements.map((group) => (
                <div key={group.key} className="ed-element-group">
                  <div className="ed-element-group-head">
                    <span>{group.label}</span>
                    <small>{group.items.length}</small>
                  </div>
                  <div className="ed-element-grid">
                    {group.items.map((def) => {
                      const IconComp = ICON_MAP[def.iconName] || Box;
                      return (
                        <PaletteDraggableItem
                          key={def.type}
                          elementType={def.type}
                          label={def.label}
                          onClickInsert={() => insertElement(def.type)}
                        >
                          <span className="ed-element-tile-icon">
                            <IconComp size={16} />
                          </span>
                          <span className="ed-element-tile-label">{def.label}</span>
                        </PaletteDraggableItem>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "layers" ? (
        <div className="ed-sidebar-panel">
          <div className="ed-layers-root-head">
            <strong>{pageTitle}</strong>
            <span>Double-click to rename</span>
          </div>
          <div className="ed-sidebar-scroll ed-layers-tree">
            <button
              type="button"
              className={cn(
                "ed-layer-row ed-layer-chrome",
                selectedChrome === "header" && "is-selected"
              )}
              onClick={() => selectChrome("header")}
            >
              <PanelTop size={13} />
              <span>Site Header</span>
              <Badge tone="neutral">Global</Badge>
            </button>
            {nodes.length === 0 ? (
              <p className="muted" style={{ padding: 14, fontSize: 12.5 }}>
                Page has no elements yet. Drag an element from the Elements tab.
              </p>
            ) : (
              nodes.map((node, index) => (
                <LayerTreeRow
                  key={node.id}
                  node={node}
                  parentId={null}
                  index={index}
                  depth={0}
                />
              ))
            )}
            <button
              type="button"
              className={cn(
                "ed-layer-row ed-layer-chrome",
                selectedChrome === "footer" && "is-selected"
              )}
              onClick={() => selectChrome("footer")}
            >
              <AppWindow size={13} />
              <span>Site Footer</span>
              <Badge tone="neutral">Global</Badge>
            </button>
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="ed-sidebar-panel">
          <div className="ed-layers-root-head">
            <strong>Change History</strong>
            <span>{history.length} steps</span>
          </div>
          <div className="ed-sidebar-scroll ed-history-list">
            <button
              type="button"
              className={cn(
                "ed-history-item",
                historyIndex === -1 && "active"
              )}
              disabled={history.length === 0}
              onClick={() => jumpToHistory(-1)}
            >
              <div>
                <strong>Loaded revision</strong>
                <small>Baseline state</small>
              </div>
              <Badge tone="neutral">Base</Badge>
            </button>
            {history.map((entry, idx) => (
              <button
                key={entry.id}
                type="button"
                className={cn(
                  "ed-history-item",
                  idx === historyIndex && "active",
                  idx > historyIndex && "is-undone"
                )}
                onClick={() => jumpToHistory(idx)}
              >
                <div className="ed-history-main">
                  <strong>{entry.summary}</strong>
                  <small>
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    {entry.model ? ` · ${entry.model}` : ""}
                  </small>
                </div>
                <Badge tone={entry.source === "ai" ? "accent" : "neutral"}>
                  {entry.source === "ai" ? "AI" : "Edit"}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
