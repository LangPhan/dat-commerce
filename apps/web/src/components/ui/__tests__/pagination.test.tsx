import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Pagination, buildPaginationItems } from "@/components/ui/data-display";

afterEach(() => {
  cleanup();
});

describe("buildPaginationItems", () => {
  it("returns all pages when totalPages <= 7", () => {
    expect(buildPaginationItems(1, 1)).toEqual([1]);
    expect(buildPaginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPaginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns fixed 7-slot windows with ellipses for 52 pages", () => {
    expect(buildPaginationItems(1, 52)).toEqual([1, 2, 3, 4, 5, "ellipsis-right", 52]);
    expect(buildPaginationItems(4, 52)).toEqual([1, 2, 3, 4, 5, "ellipsis-right", 52]);
    expect(buildPaginationItems(5, 52)).toEqual([
      1,
      "ellipsis-left",
      4,
      5,
      6,
      "ellipsis-right",
      52,
    ]);
    expect(buildPaginationItems(26, 52)).toEqual([
      1,
      "ellipsis-left",
      25,
      26,
      27,
      "ellipsis-right",
      52,
    ]);
    expect(buildPaginationItems(48, 52)).toEqual([
      1,
      "ellipsis-left",
      47,
      48,
      49,
      "ellipsis-right",
      52,
    ]);
    expect(buildPaginationItems(49, 52)).toEqual([1, "ellipsis-left", 48, 49, 50, 51, 52]);
    expect(buildPaginationItems(52, 52)).toEqual([1, "ellipsis-left", 48, 49, 50, 51, 52]);
  });
});

describe("Pagination", () => {
  it("renders compact windowed controls on page 1 of 52 (312 items)", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalItems={312} pageSize={6} onPageChange={onPageChange} />);

    expect(screen.getByText("1–6 of 312")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

    const active = screen.getByRole("button", { name: "1" });
    expect(active).toHaveAttribute("aria-current", "page");

    for (const label of ["1", "2", "3", "4", "5", "52"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "6" })).not.toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 2);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);
  });

  it("renders middle window with both ellipses on page 26", () => {
    render(<Pagination page={26} totalItems={312} pageSize={6} onPageChange={vi.fn()} />);

    expect(screen.getByText("151–156 of 312")).toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
    for (const label of ["1", "25", "26", "27", "52"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "26" })).toHaveAttribute("aria-current", "page");
  });

  it("disables next button on the last page", () => {
    render(<Pagination page={52} totalItems={312} pageSize={6} onPageChange={vi.fn()} />);

    expect(screen.getByText("307–312 of 312")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "52" })).toHaveAttribute("aria-current", "page");
    for (const label of ["1", "48", "49", "50", "51", "52"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("renders all pages without ellipsis when totalPages <= 7", () => {
    render(<Pagination page={2} totalItems={30} pageSize={6} onPageChange={vi.fn()} />);

    expect(screen.queryByText("…")).not.toBeInTheDocument();
    for (const label of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
