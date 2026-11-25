import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { aiAdminApi } from "@/lib/cms-ai-api";
import {
  InspirationClarificationCard,
  ReferenceAttachmentBar,
  ReferenceUrlPopover,
  readImageFileAsReference,
} from "../ai/ReferenceInspirationControls";

describe("Phase 2 — Reference Image/URL Inspiration & Malicious URL Guard UI", () => {
  it("blocks malicious URL in ReferenceUrlPopover and attaches SAFE URLs cleanly", async () => {
    const onAttach = vi.fn();
    const spy = vi.spyOn(aiAdminApi, "inspectReferenceUrl");

    spy.mockResolvedValueOnce({
      safety: {
        url: "http://127.0.0.1:8080/admin",
        normalizedUrl: "",
        verdict: "BLOCKED",
        riskScore: 100,
        reasons: ["Direct IP address URLs are blocked; provide a public domain name"],
      },
      designDna: null,
    });

    const qc = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <ReferenceUrlPopover attachedCount={0} disabled={false} onAttach={onAttach} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByLabelText("Add reference website URL"));
    const input = await screen.findByLabelText("Reference website URL");
    fireEvent.change(input, { target: { value: "http://127.0.0.1:8080/admin" } });
    fireEvent.click(screen.getByText("Scan & Add"));

    await waitFor(() => {
      expect(screen.getByText(/Malicious \/ Unsafe Link Blocked/i)).toBeTruthy();
    });
    expect(onAttach).not.toHaveBeenCalled();

    spy.mockResolvedValueOnce({
      safety: {
        url: "https://stripe.com",
        normalizedUrl: "https://stripe.com",
        verdict: "SAFE",
        riskScore: 0,
        reasons: ["Passed protocol, phishing heuristic, and anti-SSRF DNS checks"],
      },
      designDna: {
        url: "https://stripe.com",
        title: "Stripe",
        description: "Financial infrastructure",
        paletteColors: ["#635BFF"],
        fontFamilies: ["Inter"],
        sectionOutline: [],
        layoutHints: [],
      },
    });

    fireEvent.change(input, { target: { value: "https://stripe.com" } });
    fireEvent.click(screen.getByText("Scan & Add"));

    await waitFor(() => {
      expect(onAttach).toHaveBeenCalledTimes(1);
    });
    expect(onAttach.mock.calls[0][0].normalizedUrl).toBe("https://stripe.com");
    spy.mockRestore();
  });

  it("renders attachment bar mode pills, clarification choices, and validates image MIME types", async () => {
    const onChangeMode = vi.fn();
    const onSelect = vi.fn();

    render(
      <>
        <ReferenceAttachmentBar
          images={[{ name: "hero.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }]}
          urls={[]}
          inspirationMode="ask"
          onChangeMode={onChangeMode}
          onRemoveImage={() => {}}
          onRemoveUrl={() => {}}
        />
        <InspirationClarificationCard
          question="Bạn muốn AI áp dụng mẫu tham khảo theo cách nào?"
          options={[
            {
              id: "vibe_keep_tokens",
              label: "Lấy vibe & bố cục, giữ Global Theme Tokens",
              description: "Giữ màu & typography thương hiệu.",
              recommended: true,
            },
            {
              id: "clone_faithful",
              label: "Tạo giống sát mẫu",
              description: "Bám sát bố cục và màu sắc.",
              recommended: false,
            },
          ]}
          busy={false}
          onSelect={onSelect}
          onDismiss={() => {}}
        />
      </>
    );

    fireEvent.click(screen.getByText("Keep Theme Tokens"));
    expect(onChangeMode).toHaveBeenCalledWith("vibe_keep_tokens");

    fireEvent.click(screen.getByText("Lấy vibe & bố cục, giữ Global Theme Tokens"));
    expect(onSelect).toHaveBeenCalledWith("vibe_keep_tokens");

    const badSvg = new File(["<svg></svg>"], "evil.svg", { type: "image/svg+xml" });
    await expect(readImageFileAsReference(badSvg)).rejects.toThrow(/PNG, JPEG, and WebP/i);
  });
});
