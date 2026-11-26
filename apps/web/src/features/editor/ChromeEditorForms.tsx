"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FolderOpen, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import {
  normalizeFooterConfig,
  normalizeHeaderConfig,
} from "@/features/storefront/chrome-defaults";
import { cmsAdminApi } from "@/lib/cms-ai-api";
import { newId } from "@/lib/format";
import type {
  NavigationItemDto,
  ThemeFooterColumn,
  ThemeFooterConfig,
  ThemeFooterSocialLink,
  ThemeHeaderConfig,
} from "@/types/api-cms-ai";
import type { BrandPaletteOption } from "./brand-palette";
import { ColorControl, ControlField } from "./inspector-controls";

const MediaPickerModal = dynamic(
  () => import("./MediaPickerModal").then((m) => m.MediaPickerModal),
  { ssr: false }
);

const SOCIAL_PLATFORM_OPTIONS: Array<{
  value: ThemeFooterSocialLink["platform"];
  label: string;
}> = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
];

export function HeaderEditorForm({
  header,
  onChange,
  canWrite = true,
  canUploadMedia = false,
  brandPalette = [],
  onNotify,
}: {
  header?: ThemeHeaderConfig | null;
  onChange: (next: ThemeHeaderConfig) => void;
  canWrite?: boolean;
  canUploadMedia?: boolean;
  brandPalette?: BrandPaletteOption[];
  onNotify?: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const cfg = normalizeHeaderConfig(header);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [newNavLabel, setNewNavLabel] = useState("");
  const [newNavUrl, setNewNavUrl] = useState("/store/shop");

  const navQuery = useQuery({
    queryKey: ["cms-admin-nav", "main"],
    queryFn: () => cmsAdminApi.getNavigation("main"),
    staleTime: 60_000,
  });

  const navMutation = useMutation({
    mutationFn: (items: NavigationItemDto[]) =>
      cmsAdminApi.updateNavigation("main", items),
    onSuccess: (updated) => {
      queryClient.setQueryData(["cms-admin-nav", "main"], updated);
      void queryClient.invalidateQueries({ queryKey: ["store-nav", "main"] });
      onNotify?.("Navigation links updated");
    },
    onError: (err) => {
      onNotify?.(
        err instanceof Error ? err.message : "Failed to update navigation"
      );
    },
  });

  const navItems = navQuery.data?.items || [];

  const updateAnn = (patch: Partial<NonNullable<ThemeHeaderConfig["announcement"]>>) =>
    onChange({
      ...cfg,
      announcement: { ...cfg.announcement, ...patch },
    });

  const updateLogo = (patch: Partial<NonNullable<ThemeHeaderConfig["logo"]>>) =>
    onChange({
      ...cfg,
      logo: { ...cfg.logo, ...patch },
    });

  const updateLayout = (patch: Partial<NonNullable<ThemeHeaderConfig["layout"]>>) =>
    onChange({
      ...cfg,
      layout: { ...cfg.layout, ...patch },
    });

  const updateActions = (patch: Partial<NonNullable<ThemeHeaderConfig["actions"]>>) =>
    onChange({
      ...cfg,
      actions: { ...cfg.actions, ...patch },
    });

  return (
    <div className="ed-chrome-form">
      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Announcement Bar</h4>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.announcement.enabled}
              onChange={(e) => updateAnn({ enabled: e.target.checked })}
            />
            <span>Show</span>
          </label>
        </div>

        <ControlField
          label="Announcement Text"
          hint="Supports {freeShippingThreshold} placeholder"
        >
          <input
            type="text"
            disabled={!canWrite}
            maxLength={160}
            value={cfg.announcement.text}
            onChange={(e) => updateAnn({ text: e.target.value })}
          />
        </ControlField>

        <ControlField label="Link URL (optional)">
          <input
            type="text"
            disabled={!canWrite}
            placeholder="/store/collections"
            value={cfg.announcement.linkUrl}
            onChange={(e) => updateAnn({ linkUrl: e.target.value })}
          />
        </ControlField>

        <div className="ed-chrome-color-grid">
          <ColorControl
            label="Background"
            value={cfg.announcement.bgColor}
            palette={brandPalette}
            onChange={(val) => updateAnn({ bgColor: val || "#1C271F" })}
          />
          <ColorControl
            label="Text Color"
            value={cfg.announcement.textColor}
            palette={brandPalette}
            onChange={(val) => updateAnn({ textColor: val || "#F3F5EF" })}
          />
        </div>
      </div>

      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Brand &amp; Logo</h4>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.logo.showIcon}
              onChange={(e) => updateLogo({ showIcon: e.target.checked })}
            />
            <span>Icon</span>
          </label>
        </div>

        <ControlField label="Brand Text">
          <input
            type="text"
            disabled={!canWrite}
            maxLength={60}
            value={cfg.logo.text}
            onChange={(e) => updateLogo({ text: e.target.value })}
          />
        </ControlField>

        <ControlField label="Logo Image URL (optional)">
          <div className="ed-chrome-inline-row">
            <input
              type="text"
              disabled={!canWrite}
              placeholder="/media/logo.png or https://..."
              value={cfg.logo.imageUrl}
              onChange={(e) => updateLogo({ imageUrl: e.target.value })}
            />
            {canWrite ? (
              <Button
                size="sm"
                type="button"
                onClick={() => setMediaOpen(true)}
                title="Choose logo from media library"
              >
                <FolderOpen size={13} />
              </Button>
            ) : null}
          </div>
        </ControlField>

        <ControlField label={`Logo Height (${cfg.logo.heightPx}px)`}>
          <input
            type="range"
            min={18}
            max={56}
            disabled={!canWrite}
            value={cfg.logo.heightPx}
            onChange={(e) => updateLogo({ heightPx: Number(e.target.value) })}
          />
        </ControlField>
      </div>

      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Navigation Links</h4>
          <span className="muted" style={{ fontSize: 11 }}>
            Saved to Main Menu
          </span>
        </div>

        <div className="ed-chrome-list">
          {navItems.map((item, idx) => (
            <div key={item.id} className="ed-chrome-list-row">
              <input
                type="text"
                disabled={!canWrite || navMutation.isPending}
                value={item.label}
                aria-label={`Nav label ${idx + 1}`}
                onChange={(e) => {
                  const next = navItems.map((row) =>
                    row.id === item.id ? { ...row, label: e.target.value } : row
                  );
                  queryClient.setQueryData(["cms-admin-nav", "main"], {
                    ...(navQuery.data || { id: "main", menuKey: "main", updatedAt: "" }),
                    items: next,
                  });
                }}
                onBlur={() => navMutation.mutate(navItems)}
              />
              <input
                type="text"
                disabled={!canWrite || navMutation.isPending}
                value={item.url}
                aria-label={`Nav URL ${idx + 1}`}
                onChange={(e) => {
                  const next = navItems.map((row) =>
                    row.id === item.id ? { ...row, url: e.target.value } : row
                  );
                  queryClient.setQueryData(["cms-admin-nav", "main"], {
                    ...(navQuery.data || { id: "main", menuKey: "main", updatedAt: "" }),
                    items: next,
                  });
                }}
                onBlur={() => navMutation.mutate(navItems)}
              />
              {canWrite ? (
                <div className="ed-chrome-row-actions">
                  <IconButton
                    label="Move link up"
                    disabled={idx === 0 || navMutation.isPending}
                    onClick={() => {
                      const next = [...navItems];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      navMutation.mutate(next);
                    }}
                  >
                    <ArrowUp size={12} />
                  </IconButton>
                  <IconButton
                    label="Move link down"
                    disabled={idx === navItems.length - 1 || navMutation.isPending}
                    onClick={() => {
                      const next = [...navItems];
                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                      navMutation.mutate(next);
                    }}
                  >
                    <ArrowDown size={12} />
                  </IconButton>
                  <IconButton
                    label="Delete link"
                    disabled={navMutation.isPending}
                    onClick={() =>
                      navMutation.mutate(navItems.filter((r) => r.id !== item.id))
                    }
                  >
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {canWrite ? (
          <div className="ed-chrome-add-row">
            <input
              type="text"
              placeholder="Label (e.g. Gear)"
              value={newNavLabel}
              onChange={(e) => setNewNavLabel(e.target.value)}
            />
            <input
              type="text"
              placeholder="/store/shop"
              value={newNavUrl}
              onChange={(e) => setNewNavUrl(e.target.value)}
            />
            <Button
              size="sm"
              type="button"
              disabled={!newNavLabel.trim() || !newNavUrl.trim() || navMutation.isPending}
              onClick={() => {
                navMutation.mutate([
                  ...navItems,
                  {
                    id: newId(),
                    label: newNavLabel.trim(),
                    url: newNavUrl.trim(),
                  },
                ]);
                setNewNavLabel("");
              }}
            >
              <Plus size={12} /> Add
            </Button>
          </div>
        ) : null}
      </div>

      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Layout &amp; Actions</h4>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.layout.sticky}
              onChange={(e) => updateLayout({ sticky: e.target.checked })}
            />
            <span>Sticky</span>
          </label>
        </div>

        <ControlField label={`Header Height (${cfg.layout.heightPx}px)`}>
          <input
            type="range"
            min={48}
            max={104}
            disabled={!canWrite}
            value={cfg.layout.heightPx}
            onChange={(e) => updateLayout({ heightPx: Number(e.target.value) })}
          />
        </ControlField>

        <div className="ed-chrome-color-grid">
          <ColorControl
            label="Background"
            value={cfg.layout.bgColor}
            palette={brandPalette}
            onChange={(val) => updateLayout({ bgColor: val || "#FFFFFF" })}
          />
          <ColorControl
            label="Text"
            value={cfg.layout.textColor}
            palette={brandPalette}
            onChange={(val) => updateLayout({ textColor: val || "#1C221E" })}
          />
          <ColorControl
            label="Border"
            value={cfg.layout.borderColor}
            palette={brandPalette}
            onChange={(val) => updateLayout({ borderColor: val || "#E3E7E0" })}
          />
        </div>

        <div className="ed-chrome-toggles-grid">
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.actions.showSearch}
              onChange={(e) => updateActions({ showSearch: e.target.checked })}
            />
            <span>Search</span>
          </label>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.actions.showWishlist}
              onChange={(e) => updateActions({ showWishlist: e.target.checked })}
            />
            <span>Wishlist</span>
          </label>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.actions.showAccount}
              onChange={(e) => updateActions({ showAccount: e.target.checked })}
            />
            <span>Account</span>
          </label>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.actions.showCart}
              onChange={(e) => updateActions({ showCart: e.target.checked })}
            />
            <span>Cart</span>
          </label>
        </div>
      </div>

      {mediaOpen ? (
        <MediaPickerModal
          open={mediaOpen}
          currentUrl={cfg.logo.imageUrl}
          canUploadMedia={canUploadMedia}
          onOpenChange={setMediaOpen}
          onSelect={(url) => updateLogo({ imageUrl: url })}
          onNotify={onNotify}
        />
      ) : null}
    </div>
  );
}

export function FooterEditorForm({
  footer,
  onChange,
  canWrite = true,
  canUploadMedia = false,
  brandPalette = [],
  onNotify,
}: {
  footer?: ThemeFooterConfig | null;
  onChange: (next: ThemeFooterConfig) => void;
  canWrite?: boolean;
  canUploadMedia?: boolean;
  brandPalette?: BrandPaletteOption[];
  onNotify?: (msg: string) => void;
}) {
  const cfg = normalizeFooterConfig(footer);
  const [mediaOpen, setMediaOpen] = useState(false);

  const updateBrand = (patch: Partial<NonNullable<ThemeFooterConfig["brand"]>>) =>
    onChange({ ...cfg, brand: { ...cfg.brand, ...patch } });

  const updateNewsletter = (
    patch: Partial<NonNullable<ThemeFooterConfig["newsletter"]>>
  ) => onChange({ ...cfg, newsletter: { ...cfg.newsletter, ...patch } });

  const updateBottom = (
    patch: Partial<NonNullable<ThemeFooterConfig["bottomBar"]>>
  ) => onChange({ ...cfg, bottomBar: { ...cfg.bottomBar, ...patch } });

  const updateStyle = (patch: Partial<NonNullable<ThemeFooterConfig["style"]>>) =>
    onChange({ ...cfg, style: { ...cfg.style, ...patch } });

  const updateColumns = (columns: ThemeFooterColumn[]) =>
    onChange({ ...cfg, columns });

  const updateSocials = (socialLinks: ThemeFooterSocialLink[]) =>
    onChange({ ...cfg, socialLinks });

  return (
    <div className="ed-chrome-form">
      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Brand Column</h4>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.brand.showIcon}
              onChange={(e) => updateBrand({ showIcon: e.target.checked })}
            />
            <span>Icon</span>
          </label>
        </div>

        <ControlField label="Store Name">
          <input
            type="text"
            disabled={!canWrite}
            maxLength={80}
            value={cfg.brand.name}
            onChange={(e) => updateBrand({ name: e.target.value })}
          />
        </ControlField>

        <ControlField label="Footer Logo URL (optional)">
          <div className="ed-chrome-inline-row">
            <input
              type="text"
              disabled={!canWrite}
              placeholder="/media/logo-light.png"
              value={cfg.brand.logoImageUrl}
              onChange={(e) => updateBrand({ logoImageUrl: e.target.value })}
            />
            {canWrite ? (
              <Button
                size="sm"
                type="button"
                onClick={() => setMediaOpen(true)}
                title="Choose footer logo"
              >
                <FolderOpen size={13} />
              </Button>
            ) : null}
          </div>
        </ControlField>

        <ControlField label="Description">
          <textarea
            rows={2}
            maxLength={280}
            disabled={!canWrite}
            value={cfg.brand.description}
            onChange={(e) => updateBrand({ description: e.target.value })}
          />
        </ControlField>
      </div>

      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Link Columns ({cfg.columns.length}/4)</h4>
          {canWrite && cfg.columns.length < 4 ? (
            <Button
              size="sm"
              type="button"
              onClick={() =>
                updateColumns([
                  ...cfg.columns,
                  {
                    id: `col-${newId()}`,
                    title: "New Column",
                    links: [{ id: `link-${newId()}`, label: "Shop", url: "/store/shop" }],
                  },
                ])
              }
            >
              <Plus size={12} /> Add column
            </Button>
          ) : null}
        </div>

        <div className="ed-chrome-columns-stack">
          {cfg.columns.map((col, colIdx) => (
            <div key={col.id} className="ed-chrome-col-card">
              <div className="ed-chrome-inline-row">
                <input
                  type="text"
                  disabled={!canWrite}
                  maxLength={40}
                  value={col.title}
                  aria-label={`Column ${colIdx + 1} title`}
                  onChange={(e) =>
                    updateColumns(
                      cfg.columns.map((c) =>
                        c.id === col.id ? { ...c, title: e.target.value } : c
                      )
                    )
                  }
                />
                {canWrite ? (
                  <IconButton
                    label="Remove column"
                    onClick={() =>
                      updateColumns(cfg.columns.filter((c) => c.id !== col.id))
                    }
                  >
                    <Trash2 size={12} />
                  </IconButton>
                ) : null}
              </div>

              <div className="ed-chrome-list">
                {col.links.map((link, linkIdx) => (
                  <div key={link.id} className="ed-chrome-list-row">
                    <input
                      type="text"
                      disabled={!canWrite}
                      maxLength={60}
                      value={link.label}
                      placeholder="Label"
                      aria-label={`Column ${colIdx + 1} link ${linkIdx + 1} label`}
                      onChange={(e) =>
                        updateColumns(
                          cfg.columns.map((c) =>
                            c.id === col.id
                              ? {
                                  ...c,
                                  links: c.links.map((l) =>
                                    l.id === link.id
                                      ? { ...l, label: e.target.value }
                                      : l
                                  ),
                                }
                              : c
                          )
                        )
                      }
                    />
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={link.url}
                      placeholder="/store/..."
                      aria-label={`Column ${colIdx + 1} link ${linkIdx + 1} URL`}
                      onChange={(e) =>
                        updateColumns(
                          cfg.columns.map((c) =>
                            c.id === col.id
                              ? {
                                  ...c,
                                  links: c.links.map((l) =>
                                    l.id === link.id ? { ...l, url: e.target.value } : l
                                  ),
                                }
                              : c
                          )
                        )
                      }
                    />
                    {canWrite ? (
                      <IconButton
                        label="Remove footer link"
                        onClick={() =>
                          updateColumns(
                            cfg.columns.map((c) =>
                              c.id === col.id
                                ? {
                                    ...c,
                                    links: c.links.filter((l) => l.id !== link.id),
                                  }
                                : c
                            )
                          )
                        }
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    ) : null}
                  </div>
                ))}
              </div>

              {canWrite && col.links.length < 10 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    updateColumns(
                      cfg.columns.map((c) =>
                        c.id === col.id
                          ? {
                              ...c,
                              links: [
                                ...c.links,
                                {
                                  id: `l-${newId()}`,
                                  label: "New link",
                                  url: "/store/shop",
                                },
                              ],
                            }
                          : c
                      )
                    )
                  }
                >
                  <Plus size={12} /> Add link
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Newsletter Signup</h4>
          <label className="ed-chrome-check">
            <input
              type="checkbox"
              disabled={!canWrite}
              checked={cfg.newsletter.enabled}
              onChange={(e) => updateNewsletter({ enabled: e.target.checked })}
            />
            <span>Enable</span>
          </label>
        </div>

        {cfg.newsletter.enabled ? (
          <>
            <ControlField label="Heading">
              <input
                type="text"
                disabled={!canWrite}
                maxLength={80}
                value={cfg.newsletter.title}
                onChange={(e) => updateNewsletter({ title: e.target.value })}
              />
            </ControlField>
            <div className="ed-chrome-inline-row">
              <ControlField label="Placeholder">
                <input
                  type="text"
                  disabled={!canWrite}
                  maxLength={80}
                  value={cfg.newsletter.placeholder}
                  onChange={(e) =>
                    updateNewsletter({ placeholder: e.target.value })
                  }
                />
              </ControlField>
              <ControlField label="Button">
                <input
                  type="text"
                  disabled={!canWrite}
                  maxLength={40}
                  value={cfg.newsletter.buttonLabel}
                  onChange={(e) =>
                    updateNewsletter({ buttonLabel: e.target.value })
                  }
                />
              </ControlField>
            </div>
          </>
        ) : null}
      </div>

      <div className="ed-chrome-section">
        <div className="ed-chrome-section-head">
          <h4>Social Links ({cfg.socialLinks.length}/8)</h4>
          {canWrite && cfg.socialLinks.length < 8 ? (
            <Button
              size="sm"
              type="button"
              onClick={() =>
                updateSocials([
                  ...cfg.socialLinks,
                  {
                    id: `soc-${newId()}`,
                    platform: "instagram",
                    url: "https://instagram.com",
                  },
                ])
              }
            >
              <Plus size={12} /> Add
            </Button>
          ) : null}
        </div>

        <div className="ed-chrome-list">
          {cfg.socialLinks.map((soc) => (
            <div key={soc.id} className="ed-chrome-list-row">
              <select
                disabled={!canWrite}
                value={soc.platform}
                onChange={(e) =>
                  updateSocials(
                    cfg.socialLinks.map((s) =>
                      s.id === soc.id
                        ? {
                            ...s,
                            platform: e.target.value as ThemeFooterSocialLink["platform"],
                          }
                        : s
                    )
                  )
                }
              >
                {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                disabled={!canWrite}
                value={soc.url}
                placeholder="https://..."
                onChange={(e) =>
                  updateSocials(
                    cfg.socialLinks.map((s) =>
                      s.id === soc.id ? { ...s, url: e.target.value } : s
                    )
                  )
                }
              />
              {canWrite ? (
                <IconButton
                  label="Remove social link"
                  onClick={() =>
                    updateSocials(cfg.socialLinks.filter((s) => s.id !== soc.id))
                  }
                >
                  <Trash2 size={12} />
                </IconButton>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="ed-chrome-section">
        <h4>Bottom Bar &amp; Colors</h4>
        <ControlField label="Copyright Text" hint="Supports {year} placeholder">
          <input
            type="text"
            disabled={!canWrite}
            maxLength={160}
            value={cfg.bottomBar.copyrightText}
            onChange={(e) => updateBottom({ copyrightText: e.target.value })}
          />
        </ControlField>
        <ControlField label="Contact Email">
          <input
            type="text"
            disabled={!canWrite}
            maxLength={120}
            value={cfg.bottomBar.contactEmail}
            onChange={(e) => updateBottom({ contactEmail: e.target.value })}
          />
        </ControlField>

        <div className="ed-chrome-color-grid">
          <ColorControl
            label="Background"
            value={cfg.style.bgColor}
            palette={brandPalette}
            onChange={(val) => updateStyle({ bgColor: val || "#1C271F" })}
          />
          <ColorControl
            label="Text"
            value={cfg.style.textColor}
            palette={brandPalette}
            onChange={(val) => updateStyle({ textColor: val || "#F3F5EF" })}
          />
          <ColorControl
            label="Muted"
            value={cfg.style.mutedColor}
            palette={brandPalette}
            onChange={(val) => updateStyle({ mutedColor: val || "#A6B7AA" })}
          />
          <ColorControl
            label="Border"
            value={cfg.style.borderColor}
            palette={brandPalette}
            onChange={(val) => updateStyle({ borderColor: val || "#2D3D31" })}
          />
        </div>
      </div>

      {mediaOpen ? (
        <MediaPickerModal
          open={mediaOpen}
          currentUrl={cfg.brand.logoImageUrl}
          canUploadMedia={canUploadMedia}
          onOpenChange={setMediaOpen}
          onSelect={(url) => updateBrand({ logoImageUrl: url })}
          onNotify={onNotify}
        />
      ) : null}
    </div>
  );
}
