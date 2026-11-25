import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Message,
  MessageContent,
  MessageResponse,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  Tool,
  ToolSection,
} from "@/components/ai-elements";

describe("Phase 3 — shadcn/ui AI Elements (Streamdown GFM Tables, Tool Cards, PromptInput)", () => {
  it("renders markdown pipe tables as rich semantic HTML tables instead of raw pipe text", () => {
    const markdownTable = [
      "| Collection | Slug | Sản phẩm |",
      "|---|---|---:|",
      "| Accessories | `accessories` | 31 |",
      "| Apparel | `apparel` | 22 |",
      "| Running Shoes | `running-shoes` | 12 |",
    ].join("\n");

    const { container } = render(
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{markdownTable}</MessageResponse>
        </MessageContent>
      </Message>
    );

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(container.querySelectorAll("thead th")).map((th) =>
      th.textContent?.trim()
    );
    expect(headers).toEqual(["Collection", "Slug", "Sản phẩm"]);

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    expect(container.querySelector("tbody code")?.textContent).toBe("accessories");
    expect(container.textContent).not.toContain("|---|---|");
  });

  it("toggles collapsible Tool card and submits PromptInput on Enter", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onEnter = vi.fn();

    render(
      <>
        <Tool name="catalog.list_collections" status="completed" durationMs={42}>
          <ToolSection title="Input" data={{ includeEmpty: true }} />
          <ToolSection title="Result" data={{ count: 14 }} />
        </Tool>

        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea
            value="Show collections table"
            onChange={() => {}}
            onSubmitEnter={onEnter}
          />
          <PromptInputSubmit disabled={false} />
        </PromptInput>
      </>
    );

    // Collapsed by default
    expect(screen.queryByText(/includeEmpty/)).toBeNull();
    fireEvent.click(screen.getByText("catalog · list_collections"));
    expect(screen.getByText(/includeEmpty/)).toBeTruthy();

    const textarea = screen.getByLabelText("Message AI Assistant");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onEnter).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
