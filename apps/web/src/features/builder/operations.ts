import {
  sanitizeCssClasses,
  sanitizeHtmlAttributes,
  sanitizeStyleValues,
} from "./sanitizers";
import { sanitizeElementMotion } from "@/features/motion/schema";
import type { ElementMotionConfig, MotionCategory, ResponsiveMotionOverride } from "@/features/motion/types";
import { isValidPartKey } from "./parts";
import {
  CONTAINER_ELEMENT_TYPES,
  type DiffRow,
  type EditorOperation,
  type ElementNode,
  type ElementType,
  type ResponsiveStyles,
  type StylePropertyKey,
} from "./types";

export const MAX_TREE_NODES = 250;
export const MAX_TREE_DEPTH = 12;

export function createElementId(prefix = "el"): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "el";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${safePrefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${safePrefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isContainerType(type: ElementType): boolean {
  return CONTAINER_ELEMENT_TYPES.has(type);
}

export function canAcceptChild(node: ElementNode): boolean {
  return isContainerType(node.type);
}

export function findNode(nodes: ElementNode[], id: string): ElementNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findNodePath(nodes: ElementNode[], id: string): ElementNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node];
    if (node.children?.length) {
      const sub = findNodePath(node.children, id);
      if (sub.length > 0) return [node, ...sub];
    }
  }
  return [];
}

export function findParent(
  nodes: ElementNode[],
  id: string
): { parent: ElementNode | null; index: number; siblings: ElementNode[] } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return { parent: null, index: i, siblings: nodes };
    }
    const childList = nodes[i].children;
    if (childList?.length) {
      for (let j = 0; j < childList.length; j++) {
        if (childList[j].id === id) {
          return { parent: nodes[i], index: j, siblings: childList };
        }
      }
      const deep = findParent(childList, id);
      if (deep) return deep;
    }
  }
  return null;
}

export function isDescendant(
  nodes: ElementNode[],
  ancestorId: string,
  candidateChildId: string
): boolean {
  if (ancestorId === candidateChildId) return true;
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor?.children?.length) return false;
  return Boolean(findNode(ancestor.children, candidateChildId));
}

export function countTreeNodes(nodes: ElementNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children?.length) {
      count += countTreeNodes(node.children);
    }
  }
  return count;
}

export function getMaxDepth(nodes: ElementNode[], currentDepth = 1): number {
  if (!nodes.length) return currentDepth - 1;
  let max = currentDepth;
  for (const node of nodes) {
    if (node.children?.length) {
      const d = getMaxDepth(node.children, currentDepth + 1);
      if (d > max) max = d;
    }
  }
  return max;
}

export function flattenTree(
  nodes: ElementNode[],
  depth = 0
): { node: ElementNode; depth: number; parentId: string | null }[] {
  const result: { node: ElementNode; depth: number; parentId: string | null }[] = [];
  const visit = (list: ElementNode[], d: number, parentId: string | null) => {
    for (const node of list) {
      result.push({ node, depth: d, parentId });
      if (node.children?.length) {
        visit(node.children, d + 1, node.id);
      }
    }
  };
  visit(nodes, depth, null);
  return result;
}

export function cloneSubtreeWithFreshIds(
  node: ElementNode,
  overrideRootId?: string
): ElementNode {
  const cloned: ElementNode = {
    ...node,
    id: overrideRootId || createElementId(node.type),
    props: structuredClone(node.props),
    styles: {
      base: { ...(node.styles?.base || {}) },
      ...(node.styles?.tablet ? { tablet: { ...node.styles.tablet } } : {}),
      ...(node.styles?.mobile ? { mobile: { ...node.styles.mobile } } : {}),
      ...(node.styles?.hover ? { hover: { ...node.styles.hover } } : {}),
    },
    ...(node.motion ? { motion: structuredClone(node.motion) } : {}),
    ...(node.visibility ? { visibility: { ...node.visibility } } : {}),
    ...(node.customCssClasses
      ? { customCssClasses: [...node.customCssClasses] }
      : {}),
    ...(node.htmlAttributes
      ? { htmlAttributes: { ...node.htmlAttributes } }
      : {}),
  };

  if (node.children) {
    cloned.children = node.children.map((child) => cloneSubtreeWithFreshIds(child));
  }
  return cloned;
}

function mapTree(
  nodes: ElementNode[],
  targetId: string,
  mapper: (node: ElementNode) => ElementNode
): ElementNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === targetId) {
      changed = true;
      return mapper(node);
    }
    if (node.children?.length) {
      const updatedChildren = mapTree(node.children, targetId, mapper);
      if (updatedChildren !== node.children) {
        changed = true;
        return { ...node, children: updatedChildren };
      }
    }
    return node;
  });
  return changed ? next : nodes;
}

function removeNodeFromTree(
  nodes: ElementNode[],
  nodeId: string
): { nextNodes: ElementNode[]; removed: ElementNode | null } {
  let removed: ElementNode | null = null;
  const walk = (list: ElementNode[]): ElementNode[] => {
    const out: ElementNode[] = [];
    for (const node of list) {
      if (node.id === nodeId) {
        removed = node;
        continue;
      }
      if (node.children?.length) {
        const nextChildren = walk(node.children);
        out.push(
          nextChildren !== node.children
            ? { ...node, children: nextChildren }
            : node
        );
      } else {
        out.push(node);
      }
    }
    return out;
  };
  return { nextNodes: walk(nodes), removed };
}

function insertNodeIntoTree(
  nodes: ElementNode[],
  parentId: string | null,
  nodeToInsert: ElementNode,
  index?: number
): ElementNode[] {
  if (parentId === null) {
    const pos =
      index === undefined ? nodes.length : Math.max(0, Math.min(index, nodes.length));
    const next = [...nodes];
    next.splice(pos, 0, nodeToInsert);
    return next;
  }

  return mapTree(nodes, parentId, (parent) => {
    if (!canAcceptChild(parent)) return parent;
    const current = parent.children || [];
    const pos =
      index === undefined ? current.length : Math.max(0, Math.min(index, current.length));
    const nextChildren = [...current];
    nextChildren.splice(pos, 0, nodeToInsert);
    return { ...parent, children: nextChildren };
  });
}

export function validateOperation(
  nodes: ElementNode[],
  op: EditorOperation
): string | null {
  switch (op.type) {
    case "batch": {
      for (const childOp of op.operations) {
        const err = validateOperation(nodes, childOp);
        if (err) return err;
      }
      return null;
    }
    case "insert_node": {
      if (op.parentId !== null) {
        const parent = findNode(nodes, op.parentId);
        if (!parent) return `Target parent '${op.parentId}' not found`;
        if (!canAcceptChild(parent)) {
          return `Element '${parent.label}' cannot contain child elements`;
        }
      }
      if (countTreeNodes(nodes) + countTreeNodes([op.node]) > MAX_TREE_NODES) {
        return `Maximum ${MAX_TREE_NODES} elements reached`;
      }
      return null;
    }
    case "move_node": {
      const source = findNode(nodes, op.nodeId);
      if (!source) return `Element '${op.nodeId}' not found`;
      if (op.targetParentId !== null) {
        if (isDescendant(nodes, op.nodeId, op.targetParentId)) {
          return "Cannot move an element inside itself or one of its descendants";
        }
        const parent = findNode(nodes, op.targetParentId);
        if (!parent) return `Target container '${op.targetParentId}' not found`;
        if (!canAcceptChild(parent)) {
          return `Element '${parent.label}' cannot accept child elements`;
        }
      }
      return null;
    }
    case "update_part_styles":
    case "reset_part_style_keys": {
      if (!isValidPartKey(op.part)) return `Invalid sub-element part '${op.part}'`;
      const target = findNode(nodes, op.nodeId);
      if (!target) return `Element '${op.nodeId}' not found`;
      return null;
    }
    case "duplicate_node":
    case "delete_node":
    case "update_props":
    case "update_styles":
    case "reset_style_keys":
    case "update_visibility":
    case "update_meta":
    case "update_advanced":
    case "set_element_animation":
    case "update_element_animation":
    case "remove_element_animation":
    case "update_responsive_animation":
    case "replace_subtree": {
      const target = findNode(nodes, op.nodeId);
      if (!target) return `Element '${op.nodeId}' not found`;
      return null;
    }
    case "apply_animation_to_selection": {
      if (!op.nodeIds.length) return "No target elements selected";
      for (const id of op.nodeIds) {
        if (!findNode(nodes, id)) return `Element '${id}' not found`;
      }
      return null;
    }
    case "wrap_nodes": {
      if (!op.nodeIds.length) return "Select at least one element to wrap";
      if (!canAcceptChild(op.wrapper)) return "Wrapper must be a container";
      for (const id of op.nodeIds) {
        if (!findNode(nodes, id)) return `Element '${id}' not found`;
      }
      return null;
    }
  }
}

export function applyOperation(
  nodes: ElementNode[],
  op: EditorOperation
): ElementNode[] {
  switch (op.type) {
    case "batch":
      return applyOperations(nodes, op.operations);

    case "update_props":
      return mapTree(nodes, op.nodeId, (node) => ({
        ...node,
        props: { ...node.props, ...op.props },
      }));

    case "update_styles": {
      const bp = op.breakpoint || "base";
      const sanitized = sanitizeStyleValues(op.styles as Record<string, unknown>);
      return mapTree(nodes, op.nodeId, (node) => {
        const existing = node.styles?.[bp] || {};
        const merged: Record<string, string | undefined> = { ...existing };
        for (const [k, v] of Object.entries(op.styles)) {
          if (v === "" || v === undefined) {
            delete merged[k];
          } else if (sanitized[k as StylePropertyKey] !== undefined) {
            merged[k] = sanitized[k as StylePropertyKey];
          }
        }
        return {
          ...node,
          styles: {
            ...node.styles,
            base: node.styles?.base || {},
            [bp]: merged,
          },
        };
      });
    }

    case "reset_style_keys": {
      const bp = op.breakpoint;
      return mapTree(nodes, op.nodeId, (node) => {
        const current = { ...(node.styles?.[bp] || {}) };
        for (const key of op.keys) {
          delete current[key];
        }
        return {
          ...node,
          styles: {
            ...node.styles,
            base: node.styles?.base || {},
            [bp]: current,
          },
        };
      });
    }

    case "update_part_styles": {
      if (!isValidPartKey(op.part)) return nodes;
      const bp = op.breakpoint || "base";
      const sanitized = sanitizeStyleValues(op.styles as Record<string, unknown>);
      return mapTree(nodes, op.nodeId, (node) => {
        const prevParts = node.partStyles || {};
        const prevPartResp: ResponsiveStyles = prevParts[op.part] || { base: {} };
        const existing = prevPartResp[bp] || {};
        const merged: Record<string, string | undefined> = { ...existing };
        for (const [k, v] of Object.entries(op.styles)) {
          if (v === "" || v === undefined) {
            delete merged[k];
          } else if (sanitized[k as StylePropertyKey] !== undefined) {
            merged[k] = sanitized[k as StylePropertyKey];
          }
        }
        const nextPartResp: ResponsiveStyles = {
          ...prevPartResp,
          base: prevPartResp.base || {},
          [bp]: merged,
        };
        const hasAny = (["base", "tablet", "mobile", "hover"] as const).some(
          (b) => Object.keys(nextPartResp[b] || {}).length > 0
        );
        const nextParts: Record<string, ResponsiveStyles> = { ...prevParts };
        if (hasAny) {
          nextParts[op.part] = nextPartResp;
        } else {
          delete nextParts[op.part];
        }
        return {
          ...node,
          partStyles: Object.keys(nextParts).length ? nextParts : undefined,
        };
      });
    }

    case "reset_part_style_keys": {
      if (!isValidPartKey(op.part)) return nodes;
      const bp = op.breakpoint;
      return mapTree(nodes, op.nodeId, (node) => {
        const prevParts = node.partStyles || {};
        const prevPartResp = prevParts[op.part];
        if (!prevPartResp) return node;
        const current = { ...(prevPartResp[bp] || {}) };
        for (const key of op.keys) {
          delete current[key];
        }
        const nextPartResp: ResponsiveStyles = {
          ...prevPartResp,
          base: prevPartResp.base || {},
          [bp]: current,
        };
        const hasAny = (["base", "tablet", "mobile", "hover"] as const).some(
          (b) => Object.keys(nextPartResp[b] || {}).length > 0
        );
        const nextParts: Record<string, ResponsiveStyles> = { ...prevParts };
        if (hasAny) {
          nextParts[op.part] = nextPartResp;
        } else {
          delete nextParts[op.part];
        }
        return {
          ...node,
          partStyles: Object.keys(nextParts).length ? nextParts : undefined,
        };
      });
    }

    case "update_visibility":
      return mapTree(nodes, op.nodeId, (node) => ({
        ...node,
        visible: op.visible !== undefined ? op.visible : node.visible,
        visibility: op.visibility
          ? { ...(node.visibility || {}), ...op.visibility }
          : node.visibility,
      }));

    case "update_meta":
      return mapTree(nodes, op.nodeId, (node) => ({
        ...node,
        label: op.label !== undefined && op.label.trim() ? op.label.trim().slice(0, 120) : node.label,
        locked: op.locked !== undefined ? op.locked : node.locked,
      }));

    case "update_advanced":
      return mapTree(nodes, op.nodeId, (node) => ({
        ...node,
        ...(op.customCssClasses !== undefined
          ? { customCssClasses: sanitizeCssClasses(op.customCssClasses) }
          : {}),
        ...(op.htmlAttributes !== undefined
          ? { htmlAttributes: sanitizeHtmlAttributes(op.htmlAttributes) }
          : {}),
      }));

    case "insert_node": {
      if (op.parentId !== null) {
        const parent = findNode(nodes, op.parentId);
        if (!parent || !canAcceptChild(parent)) return nodes;
      }
      if (countTreeNodes(nodes) + countTreeNodes([op.node]) > MAX_TREE_NODES) {
        return nodes;
      }
      const next = insertNodeIntoTree(nodes, op.parentId, op.node, op.index);
      if (getMaxDepth(next) > MAX_TREE_DEPTH) return nodes;
      return next;
    }

    case "move_node": {
      if (
        op.targetParentId !== null &&
        isDescendant(nodes, op.nodeId, op.targetParentId)
      ) {
        return nodes;
      }
      const prevParentInfo = findParent(nodes, op.nodeId);
      const { nextNodes, removed } = removeNodeFromTree(nodes, op.nodeId);
      if (!removed) return nodes;

      let targetIndex = op.index;
      if (
        prevParentInfo &&
        (prevParentInfo.parent?.id ?? null) === op.targetParentId &&
        prevParentInfo.index < op.index
      ) {
        targetIndex = Math.max(0, op.index - 1);
      }

      if (op.targetParentId !== null) {
        const target = findNode(nextNodes, op.targetParentId);
        if (!target || !canAcceptChild(target)) return nodes;
      }

      const inserted = insertNodeIntoTree(
        nextNodes,
        op.targetParentId,
        removed,
        targetIndex
      );
      if (getMaxDepth(inserted) > MAX_TREE_DEPTH) return nodes;
      return inserted;
    }

    case "duplicate_node": {
      const parentInfo = findParent(nodes, op.nodeId);
      if (!parentInfo) return nodes;
      const target = findNode(nodes, op.nodeId);
      if (!target) return nodes;
      const copy = cloneSubtreeWithFreshIds(target, op.newNodeId);
      copy.label = `${target.label} Copy`.slice(0, 120);
      if (countTreeNodes(nodes) + countTreeNodes([copy]) > MAX_TREE_NODES) {
        return nodes;
      }
      return insertNodeIntoTree(
        nodes,
        parentInfo.parent?.id ?? null,
        copy,
        parentInfo.index + 1
      );
    }

    case "delete_node": {
      const { nextNodes } = removeNodeFromTree(nodes, op.nodeId);
      return nextNodes;
    }

    case "set_element_animation": {
      const clean = op.animation ? sanitizeElementMotion(op.animation) : undefined;
      return mapTree(nodes, op.nodeId, (node) => ({
        ...node,
        motion: clean ? { schemaVersion: 1, ...clean } : undefined,
      }));
    }

    case "update_element_animation": {
      return mapTree(nodes, op.nodeId, (node) => {
        const prev = node.motion || { schemaVersion: 1, enabled: true };
        const patch = op.patch || {};
        const merged: ElementMotionConfig = {
          ...prev,
          ...patch,
          schemaVersion: 1,
          ...(patch.entrance ? { entrance: { ...(prev.entrance || {}), ...patch.entrance } } : {}),
          ...(patch.scroll ? { scroll: { ...(prev.scroll || {}), ...patch.scroll } } : {}),
          ...(patch.hover ? { hover: { ...(prev.hover || {}), ...patch.hover } } : {}),
          ...(patch.interaction ? { interaction: { ...(prev.interaction || {}), ...patch.interaction } } : {}),
          ...(patch.continuous ? { continuous: { ...(prev.continuous || {}), ...patch.continuous } } : {}),
          ...(patch.text ? { text: { ...(prev.text || {}), ...patch.text } } : {}),
          ...(patch.stagger ? { stagger: { ...(prev.stagger || {}), ...patch.stagger } } : {}),
          ...(patch.responsive
            ? {
                responsive: {
                  ...(prev.responsive || {}),
                  ...(patch.responsive.tablet
                    ? {
                        tablet: {
                          ...(prev.responsive?.tablet || {}),
                          ...patch.responsive.tablet,
                        },
                      }
                    : {}),
                  ...(patch.responsive.mobile
                    ? {
                        mobile: {
                          ...(prev.responsive?.mobile || {}),
                          ...patch.responsive.mobile,
                        },
                      }
                    : {}),
                },
              }
            : {}),
        };
        const clean = sanitizeElementMotion(merged);
        return { ...node, motion: clean };
      });
    }

    case "remove_element_animation": {
      return mapTree(nodes, op.nodeId, (node) => {
        if (!node.motion) return node;
        if (!op.category || op.category === "all") {
          return { ...node, motion: undefined };
        }
        const next: ElementMotionConfig = { ...node.motion };
        if (op.category === "entrance") delete next.entrance;
        else if (op.category === "scroll") delete next.scroll;
        else if (op.category === "hover") delete next.hover;
        else if (op.category === "interaction") delete next.interaction;
        else if (op.category === "continuous") delete next.continuous;
        else if (op.category === "text") delete next.text;
        else if (op.category === "custom") delete next.presetRef;
        const hasRemaining = Boolean(
          next.presetRef ||
            next.entrance ||
            next.scroll ||
            next.hover ||
            next.interaction ||
            next.continuous ||
            next.text ||
            next.stagger
        );
        return { ...node, motion: hasRemaining ? next : undefined };
      });
    }

    case "apply_animation_to_selection": {
      const clean = sanitizeElementMotion(op.animation);
      if (!clean) return nodes;
      let working = nodes;
      for (const id of op.nodeIds) {
        working = mapTree(working, id, (node) => ({
          ...node,
          motion: {
            ...(node.motion || { schemaVersion: 1, enabled: true }),
            ...clean,
            schemaVersion: 1,
            ...(clean.entrance ? { entrance: { ...(node.motion?.entrance || {}), ...clean.entrance } } : {}),
            ...(clean.scroll ? { scroll: { ...(node.motion?.scroll || {}), ...clean.scroll } } : {}),
            ...(clean.hover ? { hover: { ...(node.motion?.hover || {}), ...clean.hover } } : {}),
            ...(clean.interaction ? { interaction: { ...(node.motion?.interaction || {}), ...clean.interaction } } : {}),
            ...(clean.continuous ? { continuous: { ...(node.motion?.continuous || {}), ...clean.continuous } } : {}),
            ...(clean.text ? { text: { ...(node.motion?.text || {}), ...clean.text } } : {}),
            ...(clean.stagger ? { stagger: { ...(node.motion?.stagger || {}), ...clean.stagger } } : {}),
          },
        }));
      }
      return working;
    }

    case "update_responsive_animation": {
      return mapTree(nodes, op.nodeId, (node) => {
        const prev = node.motion || { schemaVersion: 1, enabled: true };
        const nextResp = { ...(prev.responsive || {}) };
        if (!op.override) {
          delete nextResp[op.breakpoint];
        } else {
          const prevBp = nextResp[op.breakpoint] || {};
          nextResp[op.breakpoint] = {
            ...prevBp,
            ...op.override,
            ...(op.override.entrance ? { entrance: { ...(prevBp.entrance || {}), ...op.override.entrance } } : {}),
            ...(op.override.scroll ? { scroll: { ...(prevBp.scroll || {}), ...op.override.scroll } } : {}),
            ...(op.override.hover ? { hover: { ...(prevBp.hover || {}), ...op.override.hover } } : {}),
            ...(op.override.interaction ? { interaction: { ...(prevBp.interaction || {}), ...op.override.interaction } } : {}),
            ...(op.override.continuous ? { continuous: { ...(prevBp.continuous || {}), ...op.override.continuous } } : {}),
            ...(op.override.text ? { text: { ...(prevBp.text || {}), ...op.override.text } } : {}),
            ...(op.override.stagger ? { stagger: { ...(prevBp.stagger || {}), ...op.override.stagger } } : {}),
          };
        }
        const merged: ElementMotionConfig = {
          ...prev,
          schemaVersion: 1,
          responsive: Object.keys(nextResp).length ? nextResp : undefined,
        };
        return { ...node, motion: sanitizeElementMotion(merged) };
      });
    }

    case "replace_subtree": {
      return mapTree(nodes, op.nodeId, () => op.node);
    }

    case "wrap_nodes": {
      if (!op.nodeIds.length || !canAcceptChild(op.wrapper)) return nodes;
      const firstParent = findParent(nodes, op.nodeIds[0]);
      if (!firstParent) return nodes;
      const idSet = new Set(op.nodeIds);
      const extracted: ElementNode[] = [];
      let working = nodes;
      for (const id of op.nodeIds) {
        const res = removeNodeFromTree(working, id);
        if (res.removed) {
          extracted.push(res.removed);
          working = res.nextNodes;
        }
      }
      if (!extracted.length) return nodes;
      const wrapperNode: ElementNode = {
        ...op.wrapper,
        children: [...(op.wrapper.children || []), ...extracted],
      };
      const parentId = firstParent.parent?.id ?? null;
      const remainingSiblings = parentId
        ? findNode(working, parentId)?.children || []
        : working;
      const insertAt = Math.min(firstParent.index, remainingSiblings.length);
      const wrapped = insertNodeIntoTree(working, parentId, wrapperNode, insertAt);
      void idSet;
      return getMaxDepth(wrapped) <= MAX_TREE_DEPTH ? wrapped : nodes;
    }
  }
}

export function applyOperations(
  nodes: ElementNode[],
  ops: EditorOperation[]
): ElementNode[] {
  return ops.reduce((acc, op) => applyOperation(acc, op), nodes);
}

export function normalizeApiOperations(
  rawOps: Array<{ type: string; [key: string]: unknown }>
): EditorOperation[] {
  const result: EditorOperation[] = [];
  for (const raw of rawOps) {
    if (!raw || typeof raw.type !== "string") continue;
    const nodeId = typeof raw.nodeId === "string" ? raw.nodeId : "";
    switch (raw.type) {
      case "update_props":
        if (nodeId && raw.props && typeof raw.props === "object") {
          result.push({
            type: "update_props",
            nodeId,
            props: raw.props as Record<string, unknown>,
          });
        }
        break;
      case "update_styles":
        if (nodeId && raw.styles && typeof raw.styles === "object") {
          const bp =
            raw.breakpoint === "tablet" ||
            raw.breakpoint === "mobile" ||
            raw.breakpoint === "hover"
              ? raw.breakpoint
              : "base";
          result.push({
            type: "update_styles",
            nodeId,
            breakpoint: bp,
            styles: sanitizeStyleValues(raw.styles as Record<string, unknown>),
          });
        }
        break;
      case "reset_style_keys":
        if (nodeId && Array.isArray(raw.keys)) {
          const bp =
            raw.breakpoint === "tablet" ||
            raw.breakpoint === "mobile" ||
            raw.breakpoint === "hover"
              ? raw.breakpoint
              : "base";
          result.push({
            type: "reset_style_keys",
            nodeId,
            breakpoint: bp,
            keys: raw.keys.filter((k): k is StylePropertyKey => typeof k === "string"),
          });
        }
        break;
      case "update_part_styles":
        if (
          nodeId &&
          typeof raw.part === "string" &&
          isValidPartKey(raw.part.trim().toLowerCase()) &&
          raw.styles &&
          typeof raw.styles === "object"
        ) {
          const bp =
            raw.breakpoint === "tablet" ||
            raw.breakpoint === "mobile" ||
            raw.breakpoint === "hover"
              ? raw.breakpoint
              : "base";
          result.push({
            type: "update_part_styles",
            nodeId,
            part: raw.part.trim().toLowerCase(),
            breakpoint: bp,
            styles: sanitizeStyleValues(raw.styles as Record<string, unknown>),
          });
        }
        break;
      case "reset_part_style_keys":
        if (
          nodeId &&
          typeof raw.part === "string" &&
          isValidPartKey(raw.part.trim().toLowerCase()) &&
          Array.isArray(raw.keys)
        ) {
          const bp =
            raw.breakpoint === "tablet" ||
            raw.breakpoint === "mobile" ||
            raw.breakpoint === "hover"
              ? raw.breakpoint
              : "base";
          result.push({
            type: "reset_part_style_keys",
            nodeId,
            part: raw.part.trim().toLowerCase(),
            breakpoint: bp,
            keys: raw.keys.filter((k): k is StylePropertyKey => typeof k === "string"),
          });
        }
        break;
      case "update_visibility":
        if (nodeId) {
          result.push({
            type: "update_visibility",
            nodeId,
            ...(typeof raw.visible === "boolean" ? { visible: raw.visible } : {}),
            ...(raw.visibility && typeof raw.visibility === "object"
              ? { visibility: raw.visibility as ElementNode["visibility"] }
              : {}),
          });
        }
        break;
      case "update_meta":
        if (nodeId) {
          result.push({
            type: "update_meta",
            nodeId,
            ...(typeof raw.label === "string" ? { label: raw.label } : {}),
            ...(typeof raw.locked === "boolean" ? { locked: raw.locked } : {}),
          });
        }
        break;
      case "insert_node":
        if (raw.node && typeof raw.node === "object") {
          result.push({
            type: "insert_node",
            parentId: typeof raw.parentId === "string" ? raw.parentId : null,
            index: typeof raw.index === "number" ? raw.index : undefined,
            node: raw.node as ElementNode,
          });
        }
        break;
      case "move_node":
        if (nodeId && typeof raw.index === "number") {
          result.push({
            type: "move_node",
            nodeId,
            targetParentId:
              typeof raw.targetParentId === "string" ? raw.targetParentId : null,
            index: raw.index,
          });
        }
        break;
      case "duplicate_node":
        if (nodeId) {
          result.push({ type: "duplicate_node", nodeId });
        }
        break;
      case "delete_node":
        if (nodeId) {
          result.push({ type: "delete_node", nodeId });
        }
        break;
      case "replace_subtree":
        if (nodeId && raw.node && typeof raw.node === "object") {
          result.push({
            type: "replace_subtree",
            nodeId,
            node: raw.node as ElementNode,
          });
        }
        break;
      case "set_element_animation": {
        const targetId = nodeId || (typeof raw.targetId === "string" ? raw.targetId : "");
        if (targetId) {
          const anim = raw.animation ? sanitizeElementMotion(raw.animation) : null;
          result.push({ type: "set_element_animation", nodeId: targetId, animation: anim ?? null });
        }
        break;
      }
      case "update_element_animation": {
        const targetId = nodeId || (typeof raw.targetId === "string" ? raw.targetId : "");
        const patchObj = (raw.patch || raw.animation) as Partial<ElementMotionConfig> | undefined;
        if (targetId && patchObj && typeof patchObj === "object") {
          result.push({ type: "update_element_animation", nodeId: targetId, patch: patchObj });
        }
        break;
      }
      case "remove_element_animation": {
        const targetId = nodeId || (typeof raw.targetId === "string" ? raw.targetId : "");
        if (targetId) {
          result.push({
            type: "remove_element_animation",
            nodeId: targetId,
            category: typeof raw.category === "string" ? (raw.category as MotionCategory | "all") : "all",
          });
        }
        break;
      }
      case "apply_animation_to_selection": {
        const ids = Array.isArray(raw.nodeIds)
          ? raw.nodeIds.filter((x): x is string => typeof x === "string")
          : Array.isArray(raw.targetIds)
            ? raw.targetIds.filter((x): x is string => typeof x === "string")
            : [];
        const anim = sanitizeElementMotion(raw.animation);
        if (ids.length && anim) {
          result.push({ type: "apply_animation_to_selection", nodeIds: ids, animation: anim });
        }
        break;
      }
      case "update_responsive_animation": {
        const targetId = nodeId || (typeof raw.targetId === "string" ? raw.targetId : "");
        const bp = raw.breakpoint === "tablet" || raw.breakpoint === "mobile" ? raw.breakpoint : null;
        if (targetId && bp) {
          result.push({
            type: "update_responsive_animation",
            nodeId: targetId,
            breakpoint: bp,
            override: (raw.override as ResponsiveMotionOverride | null) ?? null,
          });
        }
        break;
      }
      default:
        break;
    }
  }
  return result;
}

export function computeNodeDiffs(
  beforeNodes: ElementNode[],
  afterNodes: ElementNode[]
): DiffRow[] {
  const diffs: DiffRow[] = [];
  const beforeFlat = flattenTree(beforeNodes);
  const afterFlat = flattenTree(afterNodes);
  const beforeMap = new Map(beforeFlat.map((entry) => [entry.node.id, entry.node]));
  const afterMap = new Map(afterFlat.map((entry) => [entry.node.id, entry.node]));

  for (const { node: after } of afterFlat) {
    const before = beforeMap.get(after.id);
    if (!before) {
      diffs.push({
        nodeId: after.id,
        nodeLabel: after.label,
        field: "element",
        before: "None",
        after: `Added ${after.type}`,
      });
      continue;
    }

    if (before.visible !== after.visible) {
      diffs.push({
        nodeId: after.id,
        nodeLabel: after.label,
        field: "visible",
        before: String(before.visible),
        after: String(after.visible),
      });
    }

    for (const bp of ["base", "tablet", "mobile", "hover"] as const) {
      const bMap = before.styles?.[bp] || {};
      const aMap = after.styles?.[bp] || {};
      const keys = new Set([...Object.keys(bMap), ...Object.keys(aMap)]);
      for (const k of keys) {
        const bv = bMap[k as StylePropertyKey] ?? "auto";
        const av = aMap[k as StylePropertyKey] ?? "auto";
        if (bv !== av) {
          diffs.push({
            nodeId: after.id,
            nodeLabel: after.label,
            field: bp === "base" ? k : `${bp}.${k}`,
            before: bv,
            after: av,
          });
        }
      }
    }

    const partKeys = new Set([
      ...Object.keys(before.partStyles || {}),
      ...Object.keys(after.partStyles || {}),
    ]);
    for (const part of partKeys) {
      const bPart = before.partStyles?.[part];
      const aPart = after.partStyles?.[part];
      for (const bp of ["base", "tablet", "mobile", "hover"] as const) {
        const bMap = bPart?.[bp] || {};
        const aMap = aPart?.[bp] || {};
        const keys = new Set([...Object.keys(bMap), ...Object.keys(aMap)]);
        for (const k of keys) {
          const bv = bMap[k as StylePropertyKey] ?? "auto";
          const av = aMap[k as StylePropertyKey] ?? "auto";
          if (bv !== av) {
            diffs.push({
              nodeId: after.id,
              nodeLabel: after.label,
              field: bp === "base" ? `part:${part}.${k}` : `part:${part}.${bp}.${k}`,
              before: bv,
              after: av,
            });
          }
        }
      }
    }

    if (JSON.stringify(before.motion || null) !== JSON.stringify(after.motion || null)) {
      const summarizeMotion = (m?: ElementMotionConfig) => {
        if (!m || m.enabled === false) return "None";
        const tags: string[] = [];
        if (m.entrance?.enabled && m.entrance.preset && m.entrance.preset !== "none") {
          tags.push(`Entrance: ${m.entrance.preset} (${m.entrance.duration ?? 600}ms)`);
        }
        if (m.scroll?.enabled && m.scroll.effect && m.scroll.effect !== "none") {
          tags.push(`Scroll: ${m.scroll.effect}`);
        }
        if (m.hover?.enabled && m.hover.preset && m.hover.preset !== "none") {
          tags.push(`Hover: ${m.hover.preset}`);
        }
        if (m.interaction?.enabled && m.interaction.preset && m.interaction.preset !== "none") {
          tags.push(`Click: ${m.interaction.preset}`);
        }
        if (m.continuous?.enabled && m.continuous.preset && m.continuous.preset !== "none") {
          tags.push(`Loop: ${m.continuous.preset}`);
        }
        if (m.text?.enabled && m.text.preset && m.text.preset !== "none") {
          tags.push(`Text: ${m.text.preset}`);
        }
        if (m.stagger?.enabled) {
          tags.push(`Stagger: ${m.stagger.interval ?? 80}ms`);
        }
        if (m.responsive?.tablet || m.responsive?.mobile) {
          tags.push("Responsive");
        }
        return tags.length ? tags.join(" · ") : "Configured";
      };
      diffs.push({
        nodeId: after.id,
        nodeLabel: after.label,
        field: "motion",
        before: summarizeMotion(before.motion),
        after: summarizeMotion(after.motion),
      });
    }

    const propKeys = new Set([
      ...Object.keys(before.props || {}),
      ...Object.keys(after.props || {}),
    ]);
    for (const k of propKeys) {
      const bv = JSON.stringify(before.props?.[k]);
      const av = JSON.stringify(after.props?.[k]);
      if (bv !== av) {
        diffs.push({
          nodeId: after.id,
          nodeLabel: after.label,
          field: `props.${k}`,
          before: bv ?? "unset",
          after: av ?? "unset",
        });
      }
    }
  }

  for (const { node: before } of beforeFlat) {
    if (!afterMap.has(before.id)) {
      diffs.push({
        nodeId: before.id,
        nodeLabel: before.label,
        field: "element",
        before: before.type,
        after: "Removed",
      });
    }
  }

  return diffs;
}
