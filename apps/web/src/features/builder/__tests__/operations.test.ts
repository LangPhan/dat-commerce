import { describe, expect, it } from "vitest";
import {
  applyOperation,
  applyOperations,
  computeNodeDiffs,
  findNode,
  isDescendant,
  validateOperation,
} from "../operations";
import { createElementNode } from "../registry/definitions";
import { useEditorStore } from "../store/editor-store";

describe("builder tree operations & history", () => {
  it("supports nested insert, reparent move, duplicate, delete, and prevents cycles", () => {
    const sec1 = createElementNode("section");
    sec1.id = "sec-1";
    const col = createElementNode("container");
    col.id = "col-1";
    const heading = createElementNode("heading");
    heading.id = "h-1";
    col.children = [heading];
    sec1.children = [col];

    const sec2 = createElementNode("section");
    sec2.id = "sec-2";

    const tree = [sec1, sec2];

    // Prevent dropping parent inside its own child
    const cycleErr = validateOperation(tree, {
      type: "move_node",
      nodeId: "sec-1",
      targetParentId: "col-1",
      index: 0,
    });
    expect(cycleErr).toMatch(/descendant/i);
    expect(isDescendant(tree, "sec-1", "h-1")).toBe(true);

    // Prevent dropping into leaf node
    const leafErr = validateOperation(tree, {
      type: "move_node",
      nodeId: "sec-2",
      targetParentId: "h-1",
      index: 0,
    });
    expect(leafErr).toMatch(/cannot accept child/i);

    // Move heading from sec-1/col-1 into sec-2
    const moved = applyOperation(tree, {
      type: "move_node",
      nodeId: "h-1",
      targetParentId: "sec-2",
      index: 0,
    });
    expect(findNode(moved, "col-1")?.children).toHaveLength(0);
    expect(findNode(moved, "sec-2")?.children?.[0]?.id).toBe("h-1");

    // Duplicate creates fresh subtree IDs
    const duplicated = applyOperation(moved, {
      type: "duplicate_node",
      nodeId: "h-1",
      newNodeId: "h-1-copy",
    });
    expect(findNode(duplicated, "sec-2")?.children).toHaveLength(2);
    expect(findNode(duplicated, "h-1-copy")?.props.text).toBe(heading.props.text);

    // Delete removes target node cleanly
    const deleted = applyOperation(duplicated, {
      type: "delete_node",
      nodeId: "h-1-copy",
    });
    expect(findNode(deleted, "h-1-copy")).toBeNull();
  });

  it("undoes and redoes both manual edits and AI preview applications atomically", () => {
    const store = useEditorStore.getState();
    const sec = createElementNode("section");
    sec.id = "sec-a";
    const h = createElementNode("heading");
    h.id = "head-a";
    sec.children = [h];

    store.loadPage({
      pageId: "p1",
      pageSlug: "home",
      pageTitle: "Home",
      nodes: [sec],
    });

    store.updateNodeStyles("head-a", { color: "#2563EB" }, "base", "Set blue");
    expect(findNode(useEditorStore.getState().nodes, "head-a")?.styles.base.color).toBe(
      "#2563EB"
    );

    const aiPreviewNodes = applyOperations(useEditorStore.getState().nodes, [
      {
        type: "update_styles",
        nodeId: "head-a",
        breakpoint: "mobile",
        styles: { fontSize: "24px" },
      },
    ]);
    const diffs = computeNodeDiffs(useEditorStore.getState().nodes, aiPreviewNodes);
    expect(diffs).toHaveLength(1);

    // Preview must not alter committed nodes or history until applied
    store.startAiPreview({
      prompt: "Shrink on mobile",
      summary: "Mobile heading 24px",
      explanation: "",
      model: "gpt-6-luna",
      scope: "element",
      targetNodeIds: ["head-a"],
      operations: [
        {
          type: "update_styles",
          nodeId: "head-a",
          breakpoint: "mobile",
          styles: { fontSize: "24px" },
        },
      ],
      diffs,
      previewNodes: aiPreviewNodes,
      beforeNodes: useEditorStore.getState().nodes,
    });
    expect(useEditorStore.getState().history).toHaveLength(1);

    store.applyAiPreview();
    expect(useEditorStore.getState().history).toHaveLength(2);
    expect(
      findNode(useEditorStore.getState().nodes, "head-a")?.styles.mobile?.fontSize
    ).toBe("24px");

    // Undo AI batch cleanly (restoring inherited global preset state), then undo manual edit, then redo
    useEditorStore.getState().undo();
    expect(
      findNode(useEditorStore.getState().nodes, "head-a")?.styles.mobile?.fontSize
    ).toBeUndefined();

    useEditorStore.getState().undo();
    expect(findNode(useEditorStore.getState().nodes, "head-a")?.styles.base.color).not.toBe(
      "#2563EB"
    );

    useEditorStore.getState().redo();
    expect(findNode(useEditorStore.getState().nodes, "head-a")?.styles.base.color).toBe(
      "#2563EB"
    );
  });
});
