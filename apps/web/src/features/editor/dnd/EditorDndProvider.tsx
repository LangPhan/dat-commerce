"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical, Ban, Plus } from "lucide-react";
import { useState, type CSSProperties, ReactNode } from "react";
import {
  canAcceptChild,
  createElementId,
  findNode,
  findParent,
  isContainerType,
  isDescendant,
} from "@/features/builder/operations";
import { createElementNode } from "@/features/builder/registry/definitions";
import { useEditorStore } from "@/features/builder/store/editor-store";
import type { ElementNode, ElementType } from "@/features/builder/types";
import { cn } from "@/lib/format";

export type DragPayload =
  | {
      kind: "palette";
      elementType: ElementType;
      label: string;
    }
  | {
      kind: "canvas" | "layer";
      nodeId: string;
      elementType: ElementType;
      label: string;
    };

export type DropTargetData =
  | {
      zone: "slot";
      parentId: string | null;
      index: number;
    }
  | {
      zone: "container";
      containerId: string;
    }
  | {
      zone: "layer";
      nodeId: string;
      parentId: string | null;
      index: number;
      isContainer: boolean;
    };

function resolveDropDestination(
  nodes: ElementNode[],
  active: DragPayload,
  overData: DropTargetData | undefined
): { targetParentId: string | null; index: number; valid: boolean; reason?: string } | null {
  if (!overData) return null;

  let targetParentId: string | null = null;
  let index = 0;

  if (overData.zone === "slot") {
    targetParentId = overData.parentId;
    index = overData.index;
  } else if (overData.zone === "container") {
    const container = findNode(nodes, overData.containerId);
    if (!container || !canAcceptChild(container)) {
      return {
        targetParentId: overData.containerId,
        index: 0,
        valid: false,
        reason: "Not a container",
      };
    }
    targetParentId = container.id;
    index = container.children?.length || 0;
  } else if (overData.zone === "layer") {
    if (overData.isContainer) {
      targetParentId = overData.nodeId;
      index = findNode(nodes, overData.nodeId)?.children?.length || 0;
    } else {
      targetParentId = overData.parentId;
      index = overData.index + 1;
    }
  }

  if (targetParentId !== null) {
    const targetParent = findNode(nodes, targetParentId);
    if (!targetParent || !canAcceptChild(targetParent)) {
      return { targetParentId, index, valid: false, reason: "Invalid drop target" };
    }
    if (targetParent.locked) {
      return { targetParentId, index, valid: false, reason: "Container locked" };
    }
  }

  if (active.kind === "canvas" || active.kind === "layer") {
    const dragged = findNode(nodes, active.nodeId);
    if (!dragged) {
      return { targetParentId, index, valid: false, reason: "Missing source" };
    }
    if (dragged.locked) {
      return { targetParentId, index, valid: false, reason: "Element locked" };
    }
    if (
      targetParentId !== null &&
      isDescendant(nodes, active.nodeId, targetParentId)
    ) {
      return {
        targetParentId,
        index,
        valid: false,
        reason: "Cannot nest inside own descendant",
      };
    }
  }

  return { targetParentId, index, valid: true };
}

export function EditorDndProvider({
  children,
  onNotify,
}: {
  children: ReactNode;
  onNotify?: (msg: string) => void;
}) {
  const executeOperation = useEditorStore((s) => s.executeOperation);
  const expandAncestors = useEditorStore((s) => s.expandAncestors);

  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [overValid, setOverValid] = useState<{ valid: boolean; reason?: string }>({
    valid: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragPayload | undefined;
    if (data) {
      setActiveDrag(data);
      setOverValid({ valid: true });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!activeDrag) return;
    const overData = event.over?.data.current as DropTargetData | undefined;
    const resolved = resolveDropDestination(
      useEditorStore.getState().nodes,
      activeDrag,
      overData
    );
    if (!resolved) {
      setOverValid({ valid: true });
      return;
    }
    setOverValid({ valid: resolved.valid, reason: resolved.reason });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const payload = activeDrag;
    setActiveDrag(null);
    setOverValid({ valid: true });

    if (!payload || !event.over) return;
    const overData = event.over.data.current as DropTargetData | undefined;
    const resolved = resolveDropDestination(
      useEditorStore.getState().nodes,
      payload,
      overData
    );
    if (!resolved || !resolved.valid) {
      if (resolved?.reason) onNotify?.(resolved.reason);
      return;
    }

    if (payload.kind === "palette") {
      const created = createElementNode(payload.elementType);
      if (
        resolved.targetParentId === null &&
        !isContainerType(payload.elementType)
      ) {
        const wrapper: ElementNode = {
          ...createElementNode("section"),
          id: createElementId("sec"),
          label: `${created.label} Section`,
          children: [created],
        };
        const ok = executeOperation(
          {
            type: "insert_node",
            parentId: null,
            index: resolved.index,
            node: wrapper,
          },
          { summary: `Insert ${created.label}`, nextSelectedIds: [created.id] }
        );
        if (ok) expandAncestors([created.id]);
        return;
      }

      const ok = executeOperation(
        {
          type: "insert_node",
          parentId: resolved.targetParentId,
          index: resolved.index,
          node: created,
        },
        { summary: `Insert ${created.label}`, nextSelectedIds: [created.id] }
      );
      if (ok) expandAncestors([created.id]);
      return;
    }

    const ok = executeOperation(
      {
        type: "move_node",
        nodeId: payload.nodeId,
        targetParentId: resolved.targetParentId,
        index: resolved.index,
      },
      { summary: `Move ${payload.label}`, nextSelectedIds: [payload.nodeId] }
    );
    if (ok) expandAncestors([payload.nodeId]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveDrag(null);
        setOverValid({ valid: true });
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            className={cn(
              "ed-drag-overlay",
              !overValid.valid && "is-invalid"
            )}
          >
            {overValid.valid ? <Plus size={13} /> : <Ban size={13} />}
            <span>{activeDrag.label}</span>
            {!overValid.valid && overValid.reason ? (
              <small>{overValid.reason}</small>
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function CanvasDropSlot({
  id,
  parentId,
  index,
  isRoot = false,
}: {
  id: string;
  parentId: string | null;
  index: number;
  isRoot?: boolean;
}) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: {
      zone: "slot",
      parentId,
      index,
    } satisfies DropTargetData,
  });

  if (!active) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "ed-drop-slot",
        isRoot && "is-root",
        isOver && "is-over"
      )}
      aria-hidden="true"
    >
      <span className="ed-drop-line" />
    </div>
  );
}

export function CanvasNodeDndShell({
  node,
  parentId,
  index,
  isSelected,
  wrapperStyle,
  children,
}: {
  node: ElementNode;
  parentId: string | null;
  index: number;
  isSelected: boolean;
  wrapperStyle?: CSSProperties;
  children: ReactNode;
}) {
  const dragData: DragPayload = {
    kind: "canvas",
    nodeId: node.id,
    elementType: node.type,
    label: node.label,
  };

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `canvas-drag-${node.id}`,
    data: dragData,
    disabled: node.locked,
  });

  const canDropInside = isContainerType(node.type) && !node.locked;
  const { setNodeRef: setContainerDropRef, isOver: isContainerOver } =
    useDroppable({
      id: `canvas-container-${node.id}`,
      data: {
        zone: "container",
        containerId: node.id,
      } satisfies DropTargetData,
      disabled: !canDropInside,
    });

  return (
    <div
      className={cn(
        "ed-dnd-item-wrap",
        wrapperStyle?.height === "100%" && "is-fill-height"
      )}
      style={wrapperStyle}
    >
      <CanvasDropSlot
        id={`slot-before-${parentId ?? "root"}-${node.id}`}
        parentId={parentId}
        index={index}
      />
      <div
        ref={(el) => {
          setDragRef(el);
          if (canDropInside) setContainerDropRef(el);
        }}
        className={cn(
          "ed-dnd-node-shell",
          isDragging && "is-dragging",
          canDropInside && isContainerOver && "is-container-over"
        )}
      >
        {isSelected && !node.locked ? (
          <button
            type="button"
            className="ed-canvas-drag-handle"
            aria-label={`Drag ${node.label}`}
            title="Drag to reorder or nest"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={12} />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function PaletteDraggableItem({
  elementType,
  label,
  onClickInsert,
  children,
}: {
  elementType: ElementType;
  label: string;
  onClickInsert: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${elementType}`,
    data: {
      kind: "palette",
      elementType,
      label,
    } satisfies DragPayload,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn("ed-element-tile", isDragging && "is-dragging")}
      onClick={onClickInsert}
      {...attributes}
      {...listeners}
    >
      {children}
    </button>
  );
}

export function findParentIdForNode(nodes: ElementNode[], nodeId: string): string | null {
  return findParent(useEditorStore.getState().nodes, nodeId)?.parent?.id ?? null;
}
