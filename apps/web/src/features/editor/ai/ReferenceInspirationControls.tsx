"use client";

import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Globe,
  Link2,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { aiAdminApi } from "@/lib/cms-ai-api";
import { cn } from "@/lib/format";
import type {
  AiClarificationOption,
  AiInspirationMode,
  ReferenceImageInput,
  UrlInspectionResult,
} from "@/types/api-cms-ai";

export const ALLOWED_REF_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const MAX_REF_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_REF_IMAGES = 3;
export const MAX_REF_URLS = 2;

export type AttachedReferenceUrl = {
  url: string;
  normalizedUrl: string;
  verdict: "SAFE" | "CAUTION" | string;
  title?: string;
  paletteColors?: string[];
  reasons: string[];
};

export const INSPIRATION_MODE_OPTIONS: Array<{
  value: AiInspirationMode;
  label: string;
}> = [
  { value: "ask", label: "Ask me" },
  { value: "vibe_keep_tokens", label: "Keep Theme Tokens" },
  { value: "clone_faithful", label: "Clone Sample" },
  { value: "visual_style_only", label: "Style Only" },
];

export async function readImageFileAsReference(
  file: File
): Promise<ReferenceImageInput> {
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_REF_IMAGE_TYPES.has(mime)) {
    throw new Error("Only PNG, JPEG, and WebP images are supported.");
  }
  if (file.size <= 0 || file.size > MAX_REF_IMAGE_BYTES) {
    throw new Error("Reference image must be under 4 MB.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image file."));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
  return {
    name: file.name || "reference.png",
    mimeType: mime,
    dataUrl,
  };
}

export function ReferenceUrlPopover({
  attachedCount,
  disabled,
  onAttach,
}: {
  attachedCount: number;
  disabled: boolean;
  onAttach: (item: AttachedReferenceUrl) => void;
}) {
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [lastResult, setLastResult] = useState<UrlInspectionResult | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const inspectMutation = useMutation({
    mutationFn: (url: string) => aiAdminApi.inspectReferenceUrl(url),
    onSuccess: (res) => {
      setLastResult(res);
      setErrMsg("");
      if (res.safety.verdict !== "BLOCKED") {
        onAttach({
          url: res.safety.url,
          normalizedUrl: res.safety.normalizedUrl || res.safety.url,
          verdict: res.safety.verdict,
          title: res.designDna?.title || undefined,
          paletteColors: res.designDna?.paletteColors || [],
          reasons: res.safety.reasons || [],
        });
        setUrlInput("");
        setOpen(false);
      }
    },
    onError: (err) => {
      setLastResult(null);
      setErrMsg(err instanceof Error ? err.message : "Could not inspect link");
    },
  });

  const handleCheck = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setErrMsg("");
    setLastResult(null);
    inspectMutation.mutate(trimmed);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled || attachedCount >= MAX_REF_URLS}
        aria-label="Add reference website URL"
        title={
          attachedCount >= MAX_REF_URLS
            ? `Up to ${MAX_REF_URLS} reference links attached`
            : "Add reference website link (checked for safety)"
        }
        className="ed-ai-attach-btn"
      >
        <Link2 size={14} />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[340px]">
        <PopoverHeader>
          <PopoverTitle>Reference Website Link</PopoverTitle>
          <PopoverDescription>
            Paste a public HTTPS website URL for design inspiration. Links are scanned for phishing, malware, and SSRF before inspection.
          </PopoverDescription>
        </PopoverHeader>

        <div className="ed-ai-url-popover-body">
          <div className="ed-ai-url-input-row">
            <input
              type="url"
              aria-label="Reference website URL"
              placeholder="https://example.com"
              value={urlInput}
              disabled={inspectMutation.isPending}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCheck();
                }
              }}
              className="ed-text-input"
            />
            <Button
              size="sm"
              variant="primary"
              disabled={!urlInput.trim() || inspectMutation.isPending}
              onClick={handleCheck}
            >
              {inspectMutation.isPending ? (
                <span className="spin inline-flex" aria-hidden="true">
                  <LoaderCircle size={12} />
                </span>
              ) : (
                <ShieldCheck size={12} />
              )}
              <span>Scan &amp; Add</span>
            </Button>
          </div>

          {lastResult?.safety.verdict === "BLOCKED" ? (
            <div className="ed-ai-url-blocked" role="alert">
              <ShieldAlert size={15} />
              <div>
                <strong>Malicious / Unsafe Link Blocked</strong>
                <ul>
                  {lastResult.safety.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {errMsg ? (
            <p className="ed-form-err" role="alert">
              {errMsg}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReferenceAttachmentBar({
  images,
  urls,
  inspirationMode,
  onChangeMode,
  onRemoveImage,
  onRemoveUrl,
}: {
  images: ReferenceImageInput[];
  urls: AttachedReferenceUrl[];
  inspirationMode: AiInspirationMode;
  onChangeMode: (next: AiInspirationMode) => void;
  onRemoveImage: (index: number) => void;
  onRemoveUrl: (index: number) => void;
}) {
  if (!images.length && !urls.length) return null;

  return (
    <div className="ed-ai-ref-bar" aria-label="Attached design references">
      <div className="ed-ai-ref-chips">
        {images.map((img, i) => (
          <div key={`${img.name}-${i}`} className="ed-ai-ref-img-chip">
            <img src={img.dataUrl} alt={img.name} />
            <span title={img.name}>{img.name}</span>
            <button
              type="button"
              aria-label={`Remove reference image ${img.name}`}
              onClick={() => onRemoveImage(i)}
            >
              <X size={11} />
            </button>
          </div>
        ))}

        {urls.map((u, i) => {
          let host = u.normalizedUrl;
          try {
            host = new URL(u.normalizedUrl).hostname;
          } catch {
            // keep raw
          }
          return (
            <div
              key={`${u.normalizedUrl}-${i}`}
              className={cn(
                "ed-ai-ref-url-chip",
                u.verdict === "CAUTION" && "caution"
              )}
              title={u.reasons.join("; ")}
            >
              {u.verdict === "CAUTION" ? (
                <AlertTriangle size={12} />
              ) : (
                <Globe size={12} />
              )}
              <span>{u.title ? `${u.title} (${host})` : host}</span>
              <Badge tone={u.verdict === "CAUTION" ? "amber" : "green"}>
                {u.verdict === "CAUTION" ? "Caution" : "Safe"}
              </Badge>
              <button
                type="button"
                aria-label={`Remove reference URL ${host}`}
                onClick={() => onRemoveUrl(i)}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="ed-ai-mode-pills"
        role="group"
        aria-label="Reference design mode"
      >
        <span className="muted" style={{ fontSize: 11 }}>
          Mode:
        </span>
        {INSPIRATION_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              "ed-ai-mode-pill",
              inspirationMode === opt.value && "active"
            )}
            onClick={() => onChangeMode(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InspirationClarificationCard({
  question,
  options,
  busy,
  onSelect,
  onDismiss,
}: {
  question: string;
  options: AiClarificationOption[];
  busy: boolean;
  onSelect: (mode: AiInspirationMode) => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="ed-ai-clarify-card"
      role="region"
      aria-label="Design reference clarification"
    >
      <div className="ed-ai-clarify-head">
        <div className="ed-ai-preview-title">
          <Sparkles size={14} />
          <strong>{question}</strong>
        </div>
        <IconButton label="Dismiss question" onClick={onDismiss}>
          <X size={13} />
        </IconButton>
      </div>

      <div className="ed-ai-clarify-grid">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={busy}
            className={cn(
              "ed-ai-clarify-opt",
              opt.recommended && "recommended"
            )}
            onClick={() => onSelect(opt.id)}
          >
            <div className="ed-ai-clarify-opt-head">
              <strong>{opt.label}</strong>
              {opt.recommended ? (
                <Badge tone="green">
                  <Check size={10} /> Recommended
                </Badge>
              ) : null}
            </div>
            <span>{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
