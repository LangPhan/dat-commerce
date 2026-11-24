"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Search, SlidersHorizontal, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { adminMediaApi } from "@/lib/commerce-api";
import { cn } from "@/lib/format";
import { FONT_ROLE_METADATA } from "../defaults";
import { searchFontCatalog } from "../font-catalog";
import { formatCssFontStack } from "../resolve";
import { useGoogleFontLoader } from "../GlobalTypographyStyleTag";
import type {
  FontLoadingStatus,
  NormalizedGlobalTypography,
  TypographyFontConfig,
  TypographyFontRole,
} from "../types";

const WEIGHT_OPTIONS = [300, 400, 500, 600, 700, 800];
const FALLBACK_STACK_OPTIONS = [
  { value: "system-ui, -apple-system, sans-serif", label: "System Sans" },
  { value: "sans-serif", label: "Generic Sans-Serif" },
  { value: '"Times New Roman", serif', label: "Editorial Serif" },
  { value: "Georgia, serif", label: "Georgia Serif" },
  { value: "ui-monospace, monospace", label: "UI Monospace" },
  { value: "monospace", label: "Generic Monospace" },
];

function StatusPill({ status }: { status: FontLoadingStatus }) {
  if (status === "loaded") {
    return <Badge tone="green">Loaded</Badge>;
  }
  if (status === "loading") {
    return (
      <Badge tone="accent">
        <Loader2 size={10} className="animate-spin" /> Loading
      </Badge>
    );
  }
  if (status === "error") {
    return <Badge tone="red">Error</Badge>;
  }
  return <Badge tone="neutral">Ready</Badge>;
}

function FontRoleConfigurator({
  role,
  config,
  loadingStatus,
  presetCount,
  disabled,
  onUpdateRole,
  onNotify,
}: {
  role: TypographyFontRole;
  config: TypographyFontConfig;
  loadingStatus: FontLoadingStatus;
  presetCount: number;
  disabled?: boolean;
  onUpdateRole: (role: TypographyFontRole, next: TypographyFontConfig) => void;
  onNotify?: (msg: string) => void;
}) {
  const meta = FONT_ROLE_METADATA[role];
  const [query, setQuery] = useState("");
  const [sourceTab, setSourceTab] = useState<"all" | "google" | "system" | "custom">(
    config.source === "custom" ? "custom" : "all"
  );
  const [customName, setCustomName] = useState(
    config.source === "custom" ? config.family : ""
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFontMutation = useMutation({
    mutationFn: (file: File) => adminMediaApi.uploadFont(file),
    onSuccess: (uploaded) => {
      const derivedName =
        customName.trim() ||
        uploaded.originalFilename
          .replace(/\.(woff2|woff|ttf)$/i, "")
          .replace(/[_-]+/g, " ")
          .replace(/[^A-Za-z0-9 _.-]/g, "")
          .trim()
          .slice(0, 48) ||
        "Custom Brand Font";
      setCustomName(derivedName);
      onUpdateRole(role, {
        family: derivedName,
        source: "custom",
        weights: [400, 500, 600, 700],
        style: config.style || "normal",
        fallback: config.fallback || "sans-serif",
        url: uploaded.url,
        format: (uploaded.format as "woff2" | "woff" | "truetype") || "woff2",
      });
      onNotify?.(`Uploaded custom font "${derivedName}" for ${meta.label}`);
    },
    onError: (err) => {
      onNotify?.(
        err instanceof Error ? err.message : "Failed to upload custom font"
      );
    },
  });

  const filteredCatalog = searchFontCatalog(
    query,
    sourceTab === "custom" ? "all" : sourceTab
  );

  const toggleWeight = (weight: number) => {
    const exists = config.weights.includes(weight);
    const nextWeights = exists
      ? config.weights.filter((w) => w !== weight)
      : [...config.weights, weight].sort((a, b) => a - b);
    if (!nextWeights.length) return;
    onUpdateRole(role, { ...config, weights: nextWeights });
  };

  return (
    <div className="typo-font-row">
      <div className="typo-font-row-main">
        <div className="typo-font-row-header">
          <div className="typo-font-role-title">
            <strong>{meta.label}</strong>
            <span className="typo-font-family-chip">{config.family}</span>
            <Badge tone="neutral">{config.source}</Badge>
            <StatusPill status={loadingStatus} />
          </div>
          <div className="typo-font-row-meta">
            <span>Fallback: {config.fallback}</span>
            <span>·</span>
            <span>
              Used by {presetCount} preset{presetCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <p className="typo-font-role-desc">{meta.description}</p>
        <div
          className="typo-font-specimen"
          style={{
            fontFamily: formatCssFontStack(config.family, config.fallback),
            fontStyle: config.style,
            fontWeight: config.weights?.[0] || 400,
          }}
        >
          Aa Bb Cc — Engineered for everyday movement · 0123456789
        </div>
      </div>

      <div className="typo-font-row-action">
        <Popover>
          <PopoverTrigger
            disabled={disabled}
            className="btn btn-sm"
          >
            <SlidersHorizontal size={13} />
            <span>Configure</span>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="w-[360px]"
          >
            <PopoverHeader>
              <PopoverTitle>{meta.label} Configuration</PopoverTitle>
              <PopoverDescription>
                Changes update every preset referencing `{role}`.
              </PopoverDescription>
            </PopoverHeader>

            <div className="typo-pop-stack">
              <div className="typo-tab-strip" role="tablist">
                {(
                  [
                    ["all", "All"],
                    ["google", "Google"],
                    ["system", "System"],
                    ["custom", "Custom Upload"],
                  ] as const
                ).map(([tabKey, tabLabel]) => (
                  <button
                    key={tabKey}
                    type="button"
                    role="tab"
                    aria-selected={sourceTab === tabKey}
                    className={cn(
                      "typo-pill-btn",
                      sourceTab === tabKey && "active"
                    )}
                    onClick={() => setSourceTab(tabKey)}
                  >
                    {tabLabel}
                  </button>
                ))}
              </div>

              {sourceTab !== "custom" ? (
                <>
                  <div className="typo-search-wrap">
                    <Search size={13} className="typo-search-icon" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search Google or System fonts..."
                      className="typo-search-input"
                    />
                  </div>
                  <div className="typo-font-catalog-list">
                    {filteredCatalog.map((item) => {
                      const selected =
                        item.family === config.family &&
                        config.source !== "custom";
                      return (
                        <button
                          key={item.family}
                          type="button"
                          className={cn(
                            "typo-catalog-item",
                            selected && "active"
                          )}
                          onClick={() =>
                            onUpdateRole(role, {
                              family: item.family,
                              source: item.source,
                              weights: item.weights,
                              style: config.style,
                              fallback: item.fallback,
                              variable: item.variable,
                            })
                          }
                        >
                          <div className="typo-catalog-item-left">
                            <span
                              className="typo-catalog-name"
                              style={{
                                fontFamily: formatCssFontStack(
                                  item.family,
                                  item.fallback
                                ),
                              }}
                            >
                              {item.family}
                            </span>
                            <span className="typo-catalog-cat">
                              {item.category} · {item.source}
                              {item.variable ? " · Variable" : ""}
                            </span>
                          </div>
                          {selected ? <Check size={13} /> : null}
                        </button>
                      );
                    })}
                    {!filteredCatalog.length ? (
                      <div className="typo-empty-note">
                        No matching font families.
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="typo-custom-upload-box">
                  <div className="typo-field-group">
                    <span className="typo-field-label">Custom font name</span>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomName(val);
                        if (config.source === "custom" && val.trim()) {
                          onUpdateRole(role, { ...config, family: val.trim() });
                        }
                      }}
                      placeholder="Brand Display Sans"
                      className="typo-text-input"
                    />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".woff2,.woff,.ttf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        uploadFontMutation.mutate(f);
                      }
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={disabled || uploadFontMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={13} />
                    {uploadFontMutation.isPending
                      ? "Uploading font..."
                      : "Upload WOFF2 / WOFF / TTF"}
                  </Button>
                  {config.source === "custom" && config.url ? (
                    <div className="typo-uploaded-meta">
                      Active asset: <code>{config.url.split("/").pop()}</code>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="typo-field-group">
                <span className="typo-field-label">Weights</span>
                <div className="typo-weight-row">
                  {WEIGHT_OPTIONS.map((w) => {
                    const active = config.weights.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        disabled={disabled}
                        className={cn("typo-weight-chip", active && "active")}
                        onClick={() => toggleWeight(w)}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="typo-two-col">
                <div className="typo-field-group">
                  <span className="typo-field-label">Font style</span>
                  <select
                    disabled={disabled}
                    value={config.style}
                    onChange={(e) =>
                      onUpdateRole(role, {
                        ...config,
                        style: e.target.value === "italic" ? "italic" : "normal",
                      })
                    }
                    className="typo-select-native"
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
                <div className="typo-field-group">
                  <span className="typo-field-label">Fallback stack</span>
                  <select
                    disabled={disabled}
                    value={config.fallback}
                    onChange={(e) =>
                      onUpdateRole(role, { ...config, fallback: e.target.value })
                    }
                    className="typo-select-native"
                  >
                    {!FALLBACK_STACK_OPTIONS.some((o) => o.value === config.fallback) ? (
                      <option value={config.fallback}>{config.fallback}</option>
                    ) : null}
                    {FALLBACK_STACK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function FontFamiliesPanel({
  typography,
  disabled,
  onUpdateFontRole,
  onNotify,
}: {
  typography: NormalizedGlobalTypography;
  disabled?: boolean;
  onUpdateFontRole: (role: TypographyFontRole, next: TypographyFontConfig) => void;
  onNotify?: (msg: string) => void;
}) {
  const statuses = useGoogleFontLoader(typography);

  const countReferencingPresets = (role: TypographyFontRole) =>
    Object.values(typography.presets).filter((p) => p.fontFamily === role).length;

  return (
    <div className="typo-fonts-panel">
      {(
        ["primary", "secondary", "heading", "body", "monospace"] as TypographyFontRole[]
      ).map((role) => (
        <FontRoleConfigurator
          key={role}
          role={role}
          config={typography.fonts[role]}
          loadingStatus={statuses[role]}
          presetCount={countReferencingPresets(role)}
          disabled={disabled}
          onUpdateRole={onUpdateFontRole}
          onNotify={onNotify}
        />
      ))}
    </div>
  );
}
