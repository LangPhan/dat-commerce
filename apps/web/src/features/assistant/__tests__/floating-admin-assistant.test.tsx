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
});
