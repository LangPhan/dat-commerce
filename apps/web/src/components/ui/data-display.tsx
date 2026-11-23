"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Upload, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button, IconButton } from "./button";

export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cn("panel", className)}>{children}</section>;
}

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="crumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.label + index} className="crumb-part">
          {index > 0 ? <ChevronRight size={13} aria-hidden="true" /> : null}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <strong>{item.label}</strong>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) {
    return (
      <span className="muted">
        Showing {totalItems} {totalItems === 1 ? "item" : "items"}
      </span>
    );
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className="ui-pagination">
      <span className="muted">
        {start}–{end} of {totalItems}
      </span>
      <div className="ui-pagination-pages">
        <IconButton
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={15} />
        </IconButton>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((num) => (
          <Button
            key={num}
            size="sm"
            variant={num === page ? "primary" : "ghost"}
            aria-current={num === page ? "page" : undefined}
            onClick={() => onPageChange(num)}
          >
            {num}
          </Button>
        ))}
        <IconButton
          label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={15} />
        </IconButton>
      </div>
    </div>
  );
}

export function Empty({
  title,
  text,
  icon,
  action,
}: {
  title: string;
  text: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <strong>{title}</strong>
      <p>{text}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="admin-skeleton" role="status" aria-label="Loading content">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}

export function FileUploader({
  label = "Upload image",
  hint = "PNG, JPG or SVG up to 2 MB",
  onUpload,
}: {
  label?: string;
  hint?: string;
  onUpload: (dataUrl: string, fileName: string) => void;
}) {
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Choose an image under 2 MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => onUpload(String(reader.result), file.name);
    reader.readAsDataURL(file);
  }

  return (
    <div className="ui-uploader-wrap">
      <label
        className={cn("ui-uploader", dragging && "dragging")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <Upload size={18} />
        <strong>{label}</strong>
        <span>{hint}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error ? (
        <p className="danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ImageGallery({
  images,
  alt,
  onRemove,
  onSelectPrimary,
}: {
  images: string[];
  alt: string;
  onRemove?: (url: string) => void;
  onSelectPrimary?: (url: string) => void;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] || images[0];

  if (!images.length) {
    return (
      <div className="upload-placeholder">
        <ImageIcon size={24} />
        <span>No images uploaded</span>
      </div>
    );
  }

  return (
    <div className="ui-gallery">
      <div className="ui-gallery-main">
        <img src={current} alt={alt} />
      </div>
      {images.length > 1 || onRemove ? (
        <div className="ui-gallery-thumbs">
          {images.map((url, idx) => (
            <div
              key={url + idx}
              className={cn("ui-gallery-thumb", idx === active && "active")}
            >
              <button
                type="button"
                aria-label={`View image ${idx + 1}`}
                onClick={() => {
                  setActive(idx);
                  onSelectPrimary?.(url);
                }}
              >
                <img src={url} alt={`${alt} view ${idx + 1}`} />
              </button>
              {onRemove ? (
                <button
                  type="button"
                  className="ui-gallery-remove"
                  aria-label="Remove image"
                  onClick={() => {
                    onRemove(url);
                    setActive(0);
                  }}
                >
                  <X size={11} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
