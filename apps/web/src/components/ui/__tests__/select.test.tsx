import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

afterEach(() => {
  cleanup();
});

describe("Select (shadcn Base UI)", () => {
  it("renders the matched item label before the popup is opened", () => {
    const items = [
      { value: "pt-1", label: "Trail Footwear" },
      { value: "pt-2", label: "Technical Packs" },
    ];
    render(
      <Select items={items} value="pt-2">
        <SelectTrigger aria-label="Product type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByRole("combobox", { name: "Product type" });
    expect(trigger).toHaveTextContent("Technical Packs");
    expect(trigger).not.toHaveTextContent("pt-2");
  });

  it("handles empty-string filter values and calls onValueChange when an option is picked", () => {
    const onValueChange = vi.fn();
    const items = [
      { value: "", label: "All categories" },
      { value: "footwear", label: "Footwear" },
    ];
    render(
      <Select items={items} value="" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Category filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value || "all"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByRole("combobox", { name: "Category filter" });
    expect(trigger).toHaveTextContent("All categories");

    fireEvent.click(trigger);
    const footwearOption = screen.getByRole("option", { name: "Footwear" });
    fireEvent.pointerDown(footwearOption);
    fireEvent.click(footwearOption);

    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls[0][0]).toBe("footwear");
  });

  it("exposes selected value in FormData when name is provided", () => {
    const items = [
      { value: "ACTIVE", label: "ACTIVE" },
      { value: "DRAFT", label: "DRAFT" },
    ];
    let submittedStatus: FormDataEntryValue | null = null;

    const { container } = render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submittedStatus = new FormData(e.currentTarget).get("status");
        }}
      >
        <Select name="status" items={items} defaultValue="ACTIVE">
          <SelectTrigger aria-label="Variant status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button type="submit">Save</button>
      </form>
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Variant status" }));
    const draftOption = screen.getByRole("option", { name: "DRAFT" });
    fireEvent.pointerDown(draftOption);
    fireEvent.click(draftOption);
    fireEvent.submit(container.querySelector("form")!);

    expect(submittedStatus).toBe("DRAFT");
  });
});
