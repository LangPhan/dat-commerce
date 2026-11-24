import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/ui/data-table";

afterEach(() => {
  cleanup();
});

type Row = { id: string; name: string };

const SAMPLE_ROWS: Row[] = Array.from({ length: 12 }, (_, idx) => ({
  id: `id-${idx + 1}`,
  name: `Product ${idx + 1}`,
}));

describe("DataTable", () => {
  it("slices rows cleanly for client-side pagination inside a scroll container", () => {
    const { container } = render(
      <DataTable
        columns={[
          { id: "id", header: "ID", cell: (r) => r.id },
          { id: "name", header: "Name", cell: (r) => r.name },
        ]}
        data={SAMPLE_ROWS}
        getRowKey={(r) => r.id}
        pageSize={5}
      />
    );

    expect(container.querySelector('[data-slot="data-table"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="data-table-scroll"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="data-table-footer"]')).toBeInTheDocument();

    expect(screen.getByText("1–5 of 12")).toBeInTheDocument();
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.queryByText("Product 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("6–10 of 12")).toBeInTheDocument();
    expect(screen.getByText("Product 6")).toBeInTheDocument();
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByText("11–12 of 12")).toBeInTheDocument();
    expect(screen.getByText("Product 12")).toBeInTheDocument();
  });

  it("supports search toolbar and server-side controlled pagination", () => {
    const onPageChange = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <DataTable
        columns={[{ id: "name", header: "Name", cell: (r) => r.name }]}
        data={SAMPLE_ROWS.slice(0, 5)}
        getRowKey={(r) => r.id}
        paginateClientSide={false}
        page={2}
        pageSize={20}
        totalItems={45}
        onPageChange={onPageChange}
        searchValue=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Search records…"
      />
    );

    expect(screen.getByText("21–40 of 45")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search records…"), {
      target: { value: "trail" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("trail");

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renders single-page pagination footer even for small datasets", () => {
    render(
      <DataTable
        columns={[{ id: "name", header: "Name", cell: (r) => r.name }]}
        data={SAMPLE_ROWS.slice(0, 3)}
        getRowKey={(r) => r.id}
        pageSize={10}
      />
    );

    expect(screen.getByText("1–3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
