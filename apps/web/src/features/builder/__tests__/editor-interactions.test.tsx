import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createElementNode } from "../registry/definitions";
import { PageRenderer } from "../renderer/PageRenderer";
import { useEditorStore } from "../store/editor-store";
import { FloatingAiBar } from "../../editor/ai/FloatingAiBar";

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

describe("nested element selection and Floating AI focus preservation", () => {
  it("selects nested child without propagating selection to its parent container", () => {
    const section = createElementNode("section");
    section.id = "sec-nested";
    section.label = "Hero Section";

    const heading = createElementNode("heading");
    heading.id = "heading-nested";
    heading.label = "Hero Title";
    heading.props = { text: "Nested Heading Title", tag: "h1" };
    section.children = [heading];

    const onSelectNode = vi.fn();

    render(
      <PageRenderer
        mode="edit"
        nodes={[section]}
        selectedIds={[]}
        onSelectNode={onSelectNode}
      />
    );

    const childText = screen.getByText("Nested Heading Title");
    fireEvent.click(childText);

    expect(onSelectNode).toHaveBeenCalledTimes(1);
    expect(onSelectNode).toHaveBeenCalledWith("heading-nested", {
      additive: false,
    });
  });

  it("keeps active selection when clicking inside FloatingAiBar and preserves chat across hide/show and focus changes", () => {
    const sec = createElementNode("section");
    sec.id = "hero-sec";
    sec.label = "Hero banner";
    const h = createElementNode("heading");
    h.id = "hero-h1";
    h.label = "Hero Heading";
    sec.children = [h];

    const store = useEditorStore.getState();
    store.loadPage({
      pageId: "page-home",
      pageSlug: "home",
      pageTitle: "Home page",
      nodes: [sec],
    });
    store.selectNode("hero-sec");
    store.setAiBarOpen(true);
    store.appendAiChatTurn("page-home", {
      id: "t1",
      timestamp: "2026-11-24T04:00:00Z",
      prompt: "Make hero darker",
      summary: "Darkened hero background",
      model: "claude-code",
      scope: "element",
      targetLabel: "Hero banner",
      targetNodeIds: ["hero-sec"],
      status: "applied",
      diffCount: 1,
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const parentDeselect = vi.fn();

    render(
      <QueryClientProvider client={qc}>
        <div onClick={parentDeselect}>
          <FloatingAiBar canUseAi canWrite onNotify={vi.fn()} />
        </div>
      </QueryClientProvider>
    );

    // Click prompt input inside FloatingAiBar — must NOT bubble to parent or clear selectedIds
    const promptInput = screen.getByLabelText("Contextual AI prompt");
    fireEvent.mouseDown(promptInput);
    fireEvent.click(promptInput);
    fireEvent.change(promptInput, { target: { value: "Increase padding to 48px" } });

    expect(parentDeselect).not.toHaveBeenCalled();
    expect(useEditorStore.getState().selectedIds).toEqual(["hero-sec"]);

    // Switch focus to Hero Heading — chat history and typed draft must persist
    act(() => {
      useEditorStore.getState().selectNode("hero-h1");
    });
    expect(useEditorStore.getState().aiChatByPage["page-home"]).toHaveLength(1);
    expect(useEditorStore.getState().aiDraftPrompt).toBe("Increase padding to 48px");
    expect(screen.getByText("Make hero darker")).toBeInTheDocument();

    // Hide AI chat -> minimized pill renders, selection & history remain intact
    fireEvent.click(screen.getByLabelText("Hide AI chat"));
    expect(useEditorStore.getState().aiBarOpen).toBe(false);
    const reopenBtn = screen.getByLabelText("Show AI chat");
    expect(reopenBtn).toBeInTheDocument();

    // Reopen AI chat -> input prompt & history turn still present
    fireEvent.click(reopenBtn);
    expect(useEditorStore.getState().aiBarOpen).toBe(true);
    expect((screen.getByLabelText("Contextual AI prompt") as HTMLInputElement).value).toBe(
      "Increase padding to 48px"
    );
    expect(screen.getByText("Make hero darker")).toBeInTheDocument();
  });
});
