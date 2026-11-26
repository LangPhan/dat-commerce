"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Search, Sparkles, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/data-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STORE_PRESET_MEDIA_ASSETS } from "@/features/builder/background-image";
import { ApiError } from "@/lib/api-client";
import { adminMediaApi } from "@/lib/commerce-api";
import { cn } from "@/lib/format";

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

type MediaTab = "library" | "presets";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function MediaPickerModal({
  open,
  currentUrl = "",
  canUploadMedia = false,
  onOpenChange,
  onSelect,
  onNotify,
}: {
  open: boolean;
  currentUrl?: string;
  canUploadMedia?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  onNotify?: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MediaTab>("library");
  const [search, setSearch] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const mediaQuery = useQuery({
    queryKey: ["admin-media"],
    queryFn: () => adminMediaApi.list(),
    enabled: open,
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminMediaApi.upload(file, file.name),
    onSuccess: (uploaded) => {
      setUploadError("");
      void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      onNotify?.(`Uploaded ${uploaded.originalFilename}`);
      onSelect(uploaded.url);
      onOpenChange(false);
    },
    onError: (err) => {
      setUploadError(
        err instanceof ApiError ? err.message : "Failed to upload image"
      );
    },
  });

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    setUploadError("");
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      setUploadError("Only JPEG, PNG, WebP, and GIF images are allowed.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Image must be under 5 MB.");
      return;
    }
    uploadMutation.mutate(file);
  };

  const deferredSearch = useDeferredValue(search);
  const q = deferredSearch.trim().toLowerCase();

  const libraryAssets = useMemo(() => {
    const assets = mediaQuery.data || [];
    if (!q) return assets;
    return assets.filter(
      (asset) =>
        asset.originalFilename.toLowerCase().includes(q) ||
        (asset.altText || "").toLowerCase().includes(q) ||
        asset.url.toLowerCase().includes(q)
    );
  }, [mediaQuery.data, q]);

  const presetAssets = useMemo(() => {
    if (!q) return STORE_PRESET_MEDIA_ASSETS;
    return STORE_PRESET_MEDIA_ASSETS.filter(
      (preset) =>
        preset.name.toLowerCase().includes(q) ||
        preset.category.toLowerCase().includes(q) ||
        preset.url.toLowerCase().includes(q)
    );
  }, [q]);

  const pickUrl = (url: string) => {
    onSelect(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Choose Image</DialogTitle>
          <DialogDescription>
            Pick an existing asset from Media Library, upload from your computer, or select a built-in store asset.
          </DialogDescription>
        </DialogHeader>

        <div className="ed-media-modal-toolbar">
          <div className="ed-media-modal-tabs" role="tablist" aria-label="Image source">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "library"}
              className={cn("ed-media-tab", tab === "library" && "active")}
              onClick={() => setTab("library")}
            >
              <ImagePlus size={13} />
              <span>Media Library ({mediaQuery.data?.length ?? 0})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "presets"}
              className={cn("ed-media-tab", tab === "presets" && "active")}
              onClick={() => setTab("presets")}
            >
              <Sparkles size={13} />
              <span>Store Assets ({STORE_PRESET_MEDIA_ASSETS.length})</span>
            </button>
          </div>

          <label className="ed-media-search">
            <Search size={13} />
            <input
              type="text"
              aria-label="Search images"
              placeholder="Filter images..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {canUploadMedia ? (
          <label
            className={cn(
              "ed-media-dropzone",
              dragOver && "is-dragover",
              uploadMutation.isPending && "is-uploading"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <Upload size={16} />
            <span>
              {uploadMutation.isPending
                ? "Uploading to Silo S3 Media Library..."
                : "Drop an image here or click to upload from your computer (PNG, JPG, WebP, GIF · max 5 MB)"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label="Upload image from computer"
              disabled={uploadMutation.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                handleFile(file);
              }}
            />
          </label>
        ) : null}

        {uploadError ? (
          <p className="ed-media-error" role="alert">
            {uploadError}
          </p>
        ) : null}

        <div className="ed-media-panel-body" role="tabpanel">
          {tab === "library" ? (
            mediaQuery.isLoading ? (
              <div className="ed-media-loading">
                <Skeleton rows={4} />
              </div>
            ) : mediaQuery.isError ? (
              <div className="ed-media-empty">
                <p>Could not load Media Library assets.</p>
                <Button size="sm" onClick={() => setTab("presets")}>
                  Browse Store Assets
                </Button>
              </div>
            ) : libraryAssets.length === 0 ? (
              <div className="ed-media-empty">
                <p>
                  {q
                    ? `No uploaded assets match "${search}".`
                    : "No uploaded media yet. Upload an image above or browse built-in Store Assets."}
                </p>
                <Button size="sm" onClick={() => setTab("presets")}>
                  Browse Store Assets
                </Button>
              </div>
            ) : (
              <div className="ed-media-grid">
                {libraryAssets.map((asset) => {
                  const selected = currentUrl === asset.url;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className={cn("ed-media-card", selected && "active")}
                      onClick={() => pickUrl(asset.url)}
                    >
                      <div className="ed-media-thumb">
                        <img src={asset.url} alt={asset.altText || asset.originalFilename} />
                        {selected ? (
                          <span className="ed-media-selected-pill">
                            <Check size={11} /> Selected
                          </span>
                        ) : null}
                      </div>
                      <div className="ed-media-meta">
                        <strong title={asset.originalFilename}>
                          {asset.originalFilename}
                        </strong>
                        <span>{formatFileSize(asset.sizeBytes)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : presetAssets.length === 0 ? (
            <div className="ed-media-empty">
              <p>{`No store assets match "${search}".`}</p>
            </div>
          ) : (
            <div className="ed-media-grid">
              {presetAssets.map((preset) => {
                const selected = currentUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn("ed-media-card", selected && "active")}
                    onClick={() => pickUrl(preset.url)}
                  >
                    <div className="ed-media-thumb">
                      <img src={preset.url} alt={preset.name} />
                      {selected ? (
                        <span className="ed-media-selected-pill">
                          <Check size={11} /> Selected
                        </span>
                      ) : null}
                    </div>
                    <div className="ed-media-meta">
                      <strong title={preset.name}>{preset.name}</strong>
                      <Badge tone="neutral">{preset.category}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
