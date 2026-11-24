"use client";

import { Search } from "lucide-react";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Empty, Pagination, Skeleton } from "./data-display";

export interface DataTableColumn<TData> {
  id: string;
  header: ReactNode;
  cell: (row: TData, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string | number;
  headerClassName?: string;
  cellClassName?: string;
}

export function DataTableCard({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table"
      className={cn("admin-table-panel ui-data-table-card", className)}
      {...props}
    />
  );
}

export function DataTableHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  if (children) {
    return (
      <div
        data-slot="data-table-header"
        className={cn("section-title ui-data-table-header", className)}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      data-slot="data-table-header"
      className={cn("section-title ui-data-table-header", className)}
    >
      <div>
        {title ? <h2>{title}</h2> : null}
        {description ? (
          <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="button-row">{actions}</div> : null}
    </div>
  );
}

export function DataTableToolbar({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-toolbar"
      className={cn("table-toolbar ui-data-table-toolbar", className)}
      {...props}
    />
  );
}

export function DataTableSearch({
  value,
  onChange,
  placeholder = "Search…",
  ariaLabel = "Search table",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <label className={cn("search-field ui-data-table-search", className)}>
      <Search size={15} />
      <input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function DataTableScrollArea({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-scroll"
      className={cn("table-scroll ui-data-table-scroll", className)}
      {...props}
    />
  );
}

export function DataTableFooter({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-footer"
      className={cn("table-footer ui-data-table-footer", className)}
      {...props}
    />
  );
}

export interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[];
  data: TData[];
  getRowKey: (row: TData, index: number) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  skeletonRows?: number;
  emptyState?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  bulkBar?: ReactNode;
  searchValue?: string;
  onSearchChange?: (next: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  page?: number;
  defaultPage?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (nextPage: number) => void;
  paginateClientSide?: boolean;
  footerExtra?: ReactNode;
  showPagination?: boolean;
  className?: string;
  scrollClassName?: string;
  tableAriaLabel?: string;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  isFetching = false,
  skeletonRows = 5,
  emptyState,
  title,
  description,
  headerActions,
  toolbar,
  bulkBar,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  page: controlledPage,
  defaultPage = 1,
  pageSize = 10,
  totalItems,
  onPageChange,
  paginateClientSide = true,
  footerExtra,
  showPagination = true,
  className,
  scrollClassName,
  tableAriaLabel,
  onRowClick,
}: DataTableProps<TData>) {
  const [internalPage, setInternalPage] = useState(defaultPage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const safePageSize = Math.max(1, pageSize);
  const resolvedTotal = totalItems ?? data.length;
  const totalPages = Math.max(1, Math.ceil(resolvedTotal / safePageSize));
  const rawPage = controlledPage ?? internalPage;
  const safePage = Math.min(Math.max(1, rawPage), totalPages);

  const visibleRows = paginateClientSide
    ? data.slice((safePage - 1) * safePageSize, safePage * safePageSize)
    : data;

  function handlePageChange(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (controlledPage === undefined) {
      setInternalPage(clamped);
    }
    onPageChange?.(clamped);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }

  function handleSearchChange(next: string) {
    if (controlledPage === undefined) {
      setInternalPage(1);
    }
    onSearchChange?.(next);
  }

  const hasToolbar = Boolean(onSearchChange || toolbar);
  const showFooter = showPagination && !isLoading && resolvedTotal > 0;

  return (
    <DataTableCard className={className}>
      {title || description || headerActions ? (
        <DataTableHeader
          title={title}
          description={description}
          actions={headerActions}
        />
      ) : null}

      {hasToolbar ? (
        <DataTableToolbar>
          {onSearchChange ? (
            <DataTableSearch
              value={searchValue ?? ""}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              ariaLabel={searchAriaLabel}
            />
          ) : null}
          {toolbar}
        </DataTableToolbar>
      ) : null}

      {bulkBar}

      {isLoading ? (
        <div className="ui-data-table-loading">
          <Skeleton rows={skeletonRows} />
        </div>
      ) : visibleRows.length ? (
        <DataTableScrollArea
          ref={scrollRef}
          aria-busy={isFetching || undefined}
          className={cn(isFetching && "is-fetching", scrollClassName)}
        >
          <table aria-label={tableAriaLabel}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.headerClassName
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, rowIndex) => (
                <tr
                  key={getRowKey(row, rowIndex)}
                  className={onRowClick ? "is-clickable" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.cellClassName
                      )}
                    >
                      {col.cell(row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableScrollArea>
      ) : (
        <div className="ui-data-table-empty">
          {emptyState ?? (
            <Empty
              title="No records found"
              text="Try adjusting your search or filter criteria."
            />
          )}
        </div>
      )}

      {showFooter ? (
        <DataTableFooter>
          <Pagination
            page={safePage}
            totalItems={resolvedTotal}
            pageSize={safePageSize}
            onPageChange={handlePageChange}
          />
          {footerExtra}
        </DataTableFooter>
      ) : null}
    </DataTableCard>
  );
}
