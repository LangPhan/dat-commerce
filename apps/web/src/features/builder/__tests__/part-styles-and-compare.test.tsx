import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { initialProducts } from "@/mocks/catalog";
import { FloatingAiBar } from "../../editor/ai/FloatingAiBar";
import {
  applyOperations,
  computeNodeDiffs,
  findNode,
  normalizeApiOperations,
} from "../operations";
import { collectEditablePartsMap } from "../parts";
import { createElementNode } from "../registry/definitions";
import { PageRenderer } from "../renderer/PageRenderer";
import { useEditorStore } from "../store/editor-store";
import { compileEditPartCss, compileLivePageCss } from "../style-compiler";

vi.mock("@/features/auth/auth-context", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth/auth-context")>(
    "@/features/auth/auth-context"
  );
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      loading: false,
      hasPermission: () => true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    }),
  };
});

describe("Deep repeating sub-element partStyles and AI Before/After toggle", () => {
  it("applies update_part_styles & reset_part_style_keys, computes diffs, and compiles edit/live/preview CSS for repeating siblings", () => {
    const grid = createElementNode("product_grid");
    grid.id = "best-grid";
    grid.label = "Best Sellers Grid";

    const editableMap = collectEditablePartsMap([grid]);
    expect(editableMap["best-grid"]).toContain("card");
    expect(editableMap["best-grid"]).toContain("price");

    const normalized = normalizeApiOperations([
      {
        type: "update_part_styles",
        nodeId: "best-grid",
        part: "card",
        breakpoint: "base",
        styles: { borderRadius: "16px", backgroundColor: "#F8FAFC" },
      },
      {
        type: "update_part_styles",
        nodeId: "best-grid",
        part: "price",
        breakpoint: "mobile",
        styles: { color: "#18794E" },
      },
    ]);
    expect(normalized).toHaveLength(2);

    const updated = applyOperations([grid], normalized);
    expect(updated[0].partStyles?.card?.base.borderRadius).toBe("16px");
    expect(updated[0].partStyles?.price?.mobile?.color).toBe("#18794E");

    const diffs = computeNodeDiffs([grid], updated);
    expect(diffs.some((d) => d.field === "part:card.borderRadius")).toBe(true);
    expect(diffs.some((d) => d.field === "part:price.mobile.color")).toBe(true);

    const liveCss = compileLivePageCss(updated);
    expect(liveCss).toContain(
      '.bldr-page-root [data-builder-node="best-grid"][data-builder-node="best-grid"] [data-builder-part="card"][data-builder-part="card"]'
    );
    expect(liveCss).toContain("border-radius: 16px;");
    expect(liveCss).toContain("@media (max-width: 640px)");

    const previewMobileCss = compileLivePageCss(updated, {
      hoverOnly: true,
      forceViewport: "mobile",
    });
    expect(previewMobileCss).toContain(
      '[data-builder-part="price"][data-builder-part="price"] { color: #18794E; }'
    );

    const editCss = compileEditPartCss(updated, "desktop", {
      selectedPart: { nodeId: "best-grid", partKey: "card" },
    });
    expect(editCss).toContain(
      '.bldr-page-root [data-editor-node-id="best-grid"][data-editor-node-id="best-grid"] [data-builder-part="card"]'
    );

    const cleared = applyOperations(updated, [
      {
        type: "reset_part_style_keys",
        nodeId: "best-grid",
        part: "price",
        breakpoint: "mobile",
        keys: ["color"],
      },
    ]);
    expect(cleared[0].partStyles?.price).toBeUndefined();
    expect(cleared[0].partStyles?.card).toBeDefined();
  });

  it("selects repeating sub-element parts directly when clicked in edit mode", () => {
    const grid = createElementNode("product_grid");
    grid.id = "best-grid";
    grid.label = "Best Sellers";
    grid.props = { columns: 2, limit: 2 };
    grid.partStyles = {
      price: { base: { color: "#18794E" } },
    };

    const onSelectPart = vi.fn();
    const { container } = render(
      <PageRenderer
        mode="edit"
        nodes={[grid]}
        catalog={initialProducts.slice(0, 2)}
        selectedIds={["best-grid"]}
        selectedPart={{ nodeId: "best-grid", partKey: "price" }}
        onSelectPart={onSelectPart}
      />
    );

    const priceEls = container.querySelectorAll('[data-builder-part="price"]');
    expect(priceEls).toHaveLength(2);
    fireEvent.click(priceEls[1]);
    expect(onSelectPart).toHaveBeenCalledWith("best-grid", "price");

    const styleTag = container.querySelector(".bldr-page-root > style");
    expect(styleTag?.textContent).toContain("color: #18794E;");
    expect(screen.getByText("Syncs all")).toBeInTheDocument();
  });

  it("supports Before/After toggle before and after applying AI changes without altering Undo history", () => {
    const grid = createElementNode("product_grid");
    grid.id = "best-grid";
    grid.label = "Best Sellers";

    const store = useEditorStore.getState();
    store.loadPage({
      pageId: "page-compare",
      pageSlug: "home",
      pageTitle: "Home page",
      nodes: [grid],
    });
    store.selectPart("best-grid", "price");

    const ops = normalizeApiOperations([
      {
        type: "update_part_styles",
        nodeId: "best-grid",
        part: "price",
        breakpoint: "base",
        styles: { color: "#18794E" },
      },
    ]);
    const previewNodes = applyOperations(useEditorStore.getState().nodes, ops);
    const diffs = computeNodeDiffs(useEditorStore.getState().nodes, previewNodes);

    act(() => {
      useEditorStore.getState().startAiPreview({
        turnId: "turn-1",
        prompt: "Make product prices green",
        summary: "Green product prices",
        explanation: "Updated repeating price color.",
        model: "gpt-6-luna",
        scope: "element",
        targetNodeIds: ["best-grid"],
        operations: ops,
        diffs,
        previewNodes,
        beforeNodes: useEditorStore.getState().nodes,
      });
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <FloatingAiBar canUseAi canWrite onNotify={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Syncs all/i)).toBeInTheDocument();
    const preGroup = screen.getByRole("group", {
      name: "Compare before and after AI changes",
    });
    expect(preGroup).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Before" }));
    expect(useEditorStore.getState().aiPreview?.viewMode).toBe("before");

    // Applying even while viewing Before must commit the After previewNodes cleanly
    fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));
    expect(useEditorStore.getState().aiPreview).toBeNull();
    expect(
      findNode(useEditorStore.getState().nodes, "best-grid")?.partStyles?.price?.base
        .color
    ).toBe("#18794E");
    expect(useEditorStore.getState().history).toHaveLength(1);

    // Post-apply comparison bar is visible and toggles Before/After
    const postGroup = screen.getByRole("group", {
      name: "Compare applied AI before and after",
    });
    expect(postGroup).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Before" }));
    expect(useEditorStore.getState().lastAppliedAiCompare?.viewingBefore).toBe(true);
    expect(
      findNode(useEditorStore.getState().nodes, "best-grid")?.partStyles?.price?.base
        .color
    ).toBe("#18794E");

    fireEvent.click(screen.getByRole("button", { name: "After" }));
    expect(useEditorStore.getState().lastAppliedAiCompare?.viewingBefore).toBe(false);

    act(() => {
      useEditorStore.getState().undo();
    });
    expect(
      findNode(useEditorStore.getState().nodes, "best-grid")?.partStyles
    ).toBeUndefined();
    expect(useEditorStore.getState().lastAppliedAiCompare).toBeNull();
  });
});
