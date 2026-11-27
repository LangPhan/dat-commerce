import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { useAdminAssistantStore } from "../assistant-ui-store";
import { FloatingAdminAssistant } from "../FloatingAdminAssistant";

const mockHasPermission = vi.fn<(p: string) => boolean>(() => true);

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    hasPermission: mockHasPermission,
    user: { email: "owner@datcommerce.local", fullName: "Owner" },
  }),
}));

describe("Phase 4 — Global Floating Admin AI Assistant", () => {
  beforeEach(() => {
    mockHasPermission.mockReset();
    mockHasPermission.mockReturnValue(true);
    useAdminAssistantStore.setState({
      floatingOpen: false,
      floatingExpanded: false,
      activeThreadId: "",
      draftPrompt: "",
    });
    vi.spyOn(aiAdminApi, "listConversations").mockResolvedValue([]);
    vi.spyOn(aiAdminApi, "getSettings").mockResolvedValue({
      defaultModelId: "gpt-6-luna",
      enabledModelIds: ["gpt-6-luna"],
      availableModelIds: ["gpt-6-luna"],
      availableModels: [
        {
          id: "gpt-6-luna",
          label: "GPT-6 Luna",
          ownedBy: "9router",
          vision: true,
          tools: true,
          reasoning: false,
        },
      ],
      gatewayReachable: true,
      gatewayError: null,
    });
  });

  it("shows FAB on admin pages, opens drawer with page context, and expands/closes cleanly", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <FloatingAdminAssistant view="products" pageTitle="Products" />
      </QueryClientProvider>
    );

    const fab = screen.getByLabelText("Open AI Assistant");
    expect(fab).toBeTruthy();

    fireEvent.click(fab);
    expect(screen.getByLabelText("Floating AI Assistant")).toBeTruthy();
    expect(screen.getByText(/Ask Dat AI about Products/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Expand panel"));
    expect(container.querySelector(".admin-ai-drawer.is-expanded")).not.toBeNull();

    fireEvent.click(screen.getByLabelText("Close floating AI Assistant"));
    expect(screen.queryByLabelText("Floating AI Assistant")).toBeNull();
    expect(screen.getByLabelText("Open AI Assistant")).toBeTruthy();
  });

  it("hides FAB on assistant page, editor view, and when lacking ai:use permission", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const r1 = render(
      <QueryClientProvider client={qc}>
        <FloatingAdminAssistant view="assistant" pageTitle="AI Assistant" />
      </QueryClientProvider>
    );
    expect(r1.queryByTestId("floating-admin-ai")).toBeNull();
    r1.unmount();

    const r2 = render(
      <QueryClientProvider client={qc}>
        <FloatingAdminAssistant view="editor" pageTitle="Theme Editor" />
      </QueryClientProvider>
    );
    expect(r2.queryByTestId("floating-admin-ai")).toBeNull();
    r2.unmount();

    mockHasPermission.mockReturnValue(false);
    const r3 = render(
      <QueryClientProvider client={qc}>
        <FloatingAdminAssistant view="orders" pageTitle="Orders" />
      </QueryClientProvider>
    );
    expect(r3.queryByTestId("floating-admin-ai")).toBeNull();
  });

  it("allows dragging the AI FAB anywhere in .admin-body below .admin-top without opening the drawer", () => {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { getByLabelText, getByTestId, queryByLabelText } = render(
      <QueryClientProvider client={qc}>
        <div className="admin-body">
          <header className="admin-top" />
          <main className="admin-content">
            <div>Admin body</div>
          </main>
        </div>
        <FloatingAdminAssistant view="products" pageTitle="Products" />
      </QueryClientProvider>
    );

    const body = document.querySelector(".admin-body") as HTMLElement;
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({
      left: 220,
      top: 0,
      right: 1920,
      bottom: 1080,
      width: 1700,
      height: 1080,
      x: 220,
      y: 0,
      toJSON: () => ({}),
    });

    const header = document.querySelector(".admin-top") as HTMLElement;
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue({
      left: 220,
      top: 0,
      right: 1920,
      bottom: 56,
      width: 1700,
      height: 56,
      x: 220,
      y: 0,
      toJSON: () => ({}),
    });

    const fab = getByLabelText("Open AI Assistant");
    vi.spyOn(fab, "getBoundingClientRect").mockReturnValue({
      left: 1740,
      top: 1010,
      right: 1896,
      bottom: 1054,
      width: 156,
      height: 44,
      x: 1740,
      y: 1010,
      toJSON: () => ({}),
    });

    // Drag over sidebar & header -> should clamp to left=232 (220+12), top=68 (56+12)
    fireEvent(fab, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 1800, clientY: 1030 }));
    fireEvent(fab, new MouseEvent("pointermove", { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent(fab, new MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent.click(fab);

    const root = getByTestId("floating-admin-ai");
    expect(root.style.left).toBe("232px");
    expect(root.style.top).toBe("68px");
    expect(queryByLabelText("Floating AI Assistant")).toBeNull();
    expect(window.localStorage.getItem("dat-commerce.admin-ai-fab-pos.v1")).toBe(
      JSON.stringify({ x: 12, y: 12 })
    );

    // Drag to far right of wide screen -> uses full .admin-body right edge (1920 - 156 - 12 = 1752)
    fireEvent(fab, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 250, clientY: 80 }));
    fireEvent(fab, new MouseEvent("pointermove", { bubbles: true, clientX: 2500, clientY: 80 }));
    fireEvent(fab, new MouseEvent("pointerup", { bubbles: true, clientX: 2500, clientY: 80 }));
    expect(root.style.left).toBe("1752px");
  });
});
