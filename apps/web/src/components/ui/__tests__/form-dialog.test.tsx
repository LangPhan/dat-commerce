import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormDialog, FormDialogField } from "@/components/ui/form-dialog";
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

describe("FormDialog (Base UI Dialog)", () => {
  it("renders separate header, body, and footer slots and submits the form", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onOpenChange = vi.fn();

    render(
      <FormDialog
        open
        onOpenChange={onOpenChange}
        size="lg"
        title="Edit category"
        description="Configure metadata"
        submitLabel="Save category"
        onSubmit={onSubmit}
      >
        <FormDialogField label="Name" htmlFor="cat-name">
          <input id="cat-name" defaultValue="Packs" />
        </FormDialogField>
      </FormDialog>
    );

    const popup = screen.getByRole("dialog");
    expect(popup).toHaveAttribute("data-slot", "dialog-content");
    expect(popup.querySelector('[data-slot="dialog-header"]')).toBeInTheDocument();
    expect(popup.querySelector('[data-slot="dialog-body"]')).toBeInTheDocument();
    expect(popup.querySelector('[data-slot="dialog-footer"]')).toBeInTheDocument();
    expect(screen.getByText("Edit category")).toBeInTheDocument();
    expect(screen.getByText("Configure metadata")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("displays alert error inside dialog body and closes via X button", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialog
        open
        onOpenChange={onOpenChange}
        title="New item"
        error="Code already exists"
        onSubmit={(e) => e.preventDefault()}
      >
        <input aria-label="Item name" />
      </FormDialog>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Code already exists");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("keeps FormDialog open when picking an option from a nested Select", () => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const items = [
      { value: "ACTIVE", label: "Active" },
      { value: "DRAFT", label: "Draft" },
    ];

    render(
      <FormDialog
        open
        onOpenChange={onOpenChange}
        title="Status test"
        onSubmit={(e) => e.preventDefault()}
      >
        <Select items={items} value="ACTIVE" onValueChange={onValueChange}>
          <SelectTrigger aria-label="Status select">
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
      </FormDialog>
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Status select" }));
    const draftOption = screen.getByRole("option", { name: "Draft" });
    fireEvent.pointerDown(draftOption);
    fireEvent.click(draftOption);

    expect(onValueChange).toHaveBeenCalledWith("DRAFT", expect.anything());
    expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
  });
});
