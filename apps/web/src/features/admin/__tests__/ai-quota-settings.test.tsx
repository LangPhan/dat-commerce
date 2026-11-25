import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { AiSettingsView } from "../ai-settings";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: {
      id: "admin-1",
      email: "owner@datcommerce.local",
      fullName: "Alex Morgan",
      roles: ["OWNER"],
      permissions: ["ai:read", "ai:write"],
    },
  }),
}));

describe("Phase 2 — Admin Storefront AI & Daily Token Quota Settings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
      customerAiEnabled: true,
      dailyTokenLimitPerUser: 20000,
      customerAiModelId: "gpt-6-luna",
    });
    vi.spyOn(aiAdminApi, "updateSettings").mockResolvedValue({
      defaultModelId: "gpt-6-luna",
      enabledModelIds: ["gpt-6-luna"],
      availableModelIds: ["gpt-6-luna"],
      availableModels: [],
      gatewayReachable: true,
      gatewayError: null,
      customerAiEnabled: true,
      dailyTokenLimitPerUser: 50000,
      customerAiModelId: "gpt-6-luna",
    });
    vi.spyOn(aiAdminApi, "getCustomerUsage").mockResolvedValue([
      {
        userId: "cust-1",
        fullName: "Samir Patel",
        email: "customer@datcommerce.local",
        accountType: "CUSTOMER",
        promptTokens: 800,
        completionTokens: 400,
        totalTokens: 1200,
        dailyLimit: 20000,
        requestCount: 3,
        updatedAt: "2026-11-25T10:00:00Z",
      },
    ]);
    vi.spyOn(aiAdminApi, "resetCustomerUsage").mockResolvedValue(undefined);
  });

  it("renders Storefront AI quota controls, updates daily limit, and resets per-account usage", async () => {
    const notify = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <AiSettingsView notify={notify} />
      </QueryClientProvider>
    );

    const limitInput = await screen.findByLabelText(/Daily Token Limit per Account/i);
    expect((limitInput as HTMLInputElement).value).toBe("20000");

    expect(await screen.findByText("customer@datcommerce.local")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "50K" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Customer AI Policy/i }));

    await waitFor(() => {
      expect(aiAdminApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAiEnabled: true,
          dailyTokenLimitPerUser: 50000,
          customerAiModelId: "gpt-6-luna",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Reset today/i }));
    await waitFor(() => {
      expect(aiAdminApi.resetCustomerUsage).toHaveBeenCalledWith("cust-1");
    });
  });
});
