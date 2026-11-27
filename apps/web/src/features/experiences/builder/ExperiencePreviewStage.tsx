"use client";

import { useDroppable } from "@dnd-kit/core";
import { GitCompare, Layers, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { PageRenderer } from "@/features/builder/renderer/PageRenderer";
import type { ElementNode } from "@/features/builder/types";
import type { StoreCategoryItem, StoreProductItem } from "@/features/storefront/blocks";
import { StoreFooter, StoreHeader } from "@/features/storefront/header-footer";
import { GlobalTypographyStyleTag } from "@/features/typography/GlobalTypographyStyleTag";
import { themeTokensToCssVars } from "@/lib/cms-schema";
import { usd } from "@/lib/format";
import type { ThemeTokens } from "@/types/api-cms-ai";
import { ZONE_LABELS } from "../catalog";
import {
  ExperienceFooterSlot,
  ExperienceHeaderFrameSlot,
  ExperienceHeroSlot,
  ExperienceOverlayRuntime,
  ExperienceTopSlot,
} from "../runtime/ExperienceRuntime";
import {
  mergeExperienceHeaderConfig,
  mergeExperienceThemeVars,
} from "../theme-merge";
import type {
  ExperienceZone,
  ResolvedExperienceLayerDto,
  ResolvedStorefrontExperienceDto,
  SeasonalExperienceConfig,
} from "../types";
import { ExperienceAiBar } from "./ExperienceAiBar";
import { useExperienceStudioStore } from "./experience-store";

const ALL_DROP_ZONES: ExperienceZone[] = [
  "top_announcement",
  "header_frame",
  "hero_stage",
  "viewport_overlay",
  "floating_corner",
  "footer_stage",
];

function StudioZoneDropTarget({
  zone,
  activeDrag,
}: {
  zone: ExperienceZone;
  activeDrag: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `exp-zone-${zone}`,
    data: { kind: "exp-zone", zone },
  });

  if (!activeDrag) return null;

  return (
    <div
      ref={setNodeRef}
      className={`exp-zone-drop zone-${zone}${isOver ? " is-over" : ""}`}
    >
      <span>Drop into {ZONE_LABELS[zone]}</span>
    </div>
  );
}

function previewProductFields(item?: StoreProductItem) {
  if (!item) {
    return {
      image: "/media/terrain-hero.jpg",
      price: 185,
      brand: "TERRAIN SUPPLY",
      name: "Ridge Runner GTX",
    };
  }
  const image =
    "minPrice" in item
      ? item.primaryImageUrl || "/media/terrain-fallback.jpg"
      : item.image || "/media/terrain-fallback.jpg";
  const price = "minPrice" in item ? Number(item.minPrice) : item.price;
  return {
    image,
    price,
    brand: item.brand || "TERRAIN",
    name: item.name,
  };
}

function ShopPreviewFallback({
  catalog,
}: {
  catalog: StoreProductItem[];
}) {
  const items = catalog.slice(0, 6);
  return (
    <section className="exp-route-preview-section">
      <div className="exp-route-preview-head">
        <span>SHOP ALL PRODUCTS</span>
        <h2>Curated Storefront Catalog</h2>
        <p>Live preview of how your seasonal experience frames product cards and CTAs.</p>
      </div>
      <div className="exp-preview-product-grid">
        {items.map((item) => {
          const prod = previewProductFields(item);
          return (
            <article key={item.id} className="exp-preview-card">
              <div className="exp-preview-card-img">
                <img src={prod.image} alt={prod.name} />
              </div>
              <div className="exp-preview-card-body">
                <small>{prod.brand}</small>
                <strong>{prod.name}</strong>
                <div className="exp-preview-card-foot">
                  <span>{usd(prod.price)}</span>
                  <button type="button" className="btn primary btn-sm">
                    Add to Bag
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProductPreviewFallback({
  catalog,
}: {
  catalog: StoreProductItem[];
}) {
  const prod = previewProductFields(catalog[0]);
  return (
    <section className="exp-route-preview-section">
      <div className="exp-pdp-preview">
        <div className="exp-pdp-media">
          <img src={prod.image} alt={prod.name} />
        </div>
        <div className="exp-pdp-info">
          <span className="exp-pdp-kicker">{prod.brand}</span>
          <h1>{prod.name}</h1>
          <strong className="exp-pdp-price">{usd(prod.price)}</strong>
          <p>
            Technical weatherproof engineering designed for demanding terrain and studio transitions.
          </p>
          <div className="button-row">
            <button type="button" className="btn primary">
              Add to Cart
            </button>
            <button type="button" className="btn">
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function toResolvedPreviewDto(
  experienceId: string,
  experienceName: string,
  endsAt: string,
  targetPages: string[],
  config: SeasonalExperienceConfig,
  reducedMotion: boolean
): ResolvedStorefrontExperienceDto {
  const layers: ResolvedExperienceLayerDto[] = (config.layers || [])
    .filter((l) => l.enabled)
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((l) => ({
      sourceExperienceId: experienceId || "preview",
      sourceExperienceName: experienceName || "Draft Experience",
      id: l.id,
      type: l.type,
      label: l.label,
      zone: l.zone,
      zIndex: l.zIndex,
      opacity: l.opacity,
      blendMode: l.blendMode,
      visibility: l.visibility,
      trigger: l.trigger,
      effectiveDensityScale: 1.0,
      experienceEndsAt: endsAt || null,
      targetPages: targetPages?.length ? targetPages : ["*"],
      props: l.props,
    }));

  return {
    enabled: true,
    resolvedAt: new Date().toISOString(),
    nextTransitionAt: null,
    mobilePerformanceMode: "ADAPTIVE",
    respectReducedMotion: reducedMotion,
    allowCustomerDismiss: false,
    globalParticleCap: 200,
    activeExperiences: [],
    effectiveThemeOverride: config.themeOverride,
    layers,
    resolutionTrace: [],
  };
}

export function ExperiencePreviewStage({
  homeNodes,
  baseThemeTokens,
  catalog,
  categories,
  activePaletteDrag,
  canUseAi,
  canWrite,
  onNotify,
}: {
  homeNodes: ElementNode[];
  baseThemeTokens?: ThemeTokens | null;
  catalog: StoreProductItem[];
  categories: StoreCategoryItem[];
  activePaletteDrag: boolean;
  canUseAi: boolean;
  canWrite: boolean;
  onNotify: (msg: string) => void;
}) {
  const experienceId = useExperienceStudioStore((s) => s.experienceId);
  const meta = useExperienceStudioStore((s) => s.meta);
  const schedule = useExperienceStudioStore((s) => s.schedule);
  const interaction = useExperienceStudioStore((s) => s.interaction);
  const config = useExperienceStudioStore((s) => s.config);
  const aiPreview = useExperienceStudioStore((s) => s.aiPreview);
  const viewport = useExperienceStudioStore((s) => s.viewport);
  const previewRoute = useExperienceStudioStore((s) => s.previewRoute);
  const compareBase = useExperienceStudioStore((s) => s.compareBase);
  const effectsPaused = useExperienceStudioStore((s) => s.effectsPaused);
  const simulateReducedMotion = useExperienceStudioStore((s) => s.simulateReducedMotion);
  const aiBarOpen = useExperienceStudioStore((s) => s.aiBarOpen);

  const displayedConfig = aiPreview
    ? aiPreview.viewMode === "before"
      ? aiPreview.beforeConfig
      : aiPreview.proposedConfig
    : config;

  const resolvedPreview = useMemo(
    () =>
      compareBase
        ? null
        : toResolvedPreviewDto(
            experienceId,
            meta.name,
            schedule.endsAt,
            interaction.targetPages,
            displayedConfig,
            simulateReducedMotion
          ),
    [
      compareBase,
      experienceId,
      meta.name,
      schedule.endsAt,
      interaction.targetPages,
      displayedConfig,
      simulateReducedMotion,
    ]
  );

  const effectiveOverride = compareBase ? null : displayedConfig.themeOverride;
  const themeCssVars = useMemo(() => {
    const base = themeTokensToCssVars(baseThemeTokens);
    return mergeExperienceThemeVars(base, effectiveOverride);
  }, [baseThemeTokens, effectiveOverride]);

  const mergedHeaderConfig = useMemo(
    () => mergeExperienceHeaderConfig(baseThemeTokens?.header, effectiveOverride),
    [baseThemeTokens?.header, effectiveOverride]
  );

  const isDark =
    !compareBase &&
    Boolean(effectiveOverride?.enabled) &&
    effectiveOverride?.mode === "dark_luxe";
  const ctaHighlight = !compareBase && effectiveOverride?.enabled ? effectiveOverride.ctaHighlight : null;

  const frameWidth =
    viewport === "mobile" ? "390px" : viewport === "tablet" ? "768px" : "100%";
  const currentPath =
    previewRoute === "shop"
      ? "/store/shop"
      : previewRoute === "product"
        ? "/store/product/featured"
        : "/";

  return (
    <main className="ed-canvas-stage exp-preview-stage">
      {compareBase ? (
        <div className="ed-canvas-before-badge" role="status">
          <GitCompare size={13} /> Comparing Base Storefront (effects hidden)
        </div>
      ) : aiPreview ? (
        <div className="ed-canvas-before-badge" role="status">
          <Sparkles size={13} /> AI Preview ({aiPreview.viewMode === "before" ? "Before" : "After"})
        </div>
      ) : null}

      <div className={`ed-canvas-scroll${!aiBarOpen ? " ed-ai-hidden" : ""}`}>
        <div
          className={`ed-artboard-frame vp-${viewport} exp-artboard`}
          style={{
            width: frameWidth,
            maxWidth: viewport === "desktop" ? "1320px" : frameWidth,
          }}
        >
          <div
            className="store public-store ed-store-surface exp-preview-surface"
            style={themeCssVars}
            data-experience-dark={isDark ? "true" : undefined}
            data-experience-cta-shimmer={
              ctaHighlight?.enabled && ctaHighlight.shimmer ? "true" : undefined
            }
            data-experience-cta-badge={
              ctaHighlight?.enabled && ctaHighlight.badgeText
                ? ctaHighlight.badgeText
                : undefined
            }
          >
            <GlobalTypographyStyleTag
              typography={baseThemeTokens?.typography}
              scopeId="exp-studio-canvas"
              scopeSelector=".exp-preview-surface"
              forceViewport={viewport}
            />

            {resolvedPreview ? (
              <ExperienceTopSlot
                experience={resolvedPreview}
                currentPath={currentPath}
                viewport={viewport}
                reducedMotionOverride={simulateReducedMotion}
              />
            ) : null}

            <div className="exp-header-anchor">
              <StoreHeader
                preview
                cart={2}
                wishlistCount={1}
                currentPath={currentPath}
                headerConfig={mergedHeaderConfig}
              />
              {resolvedPreview ? (
                <ExperienceHeaderFrameSlot
                  experience={resolvedPreview}
                  currentPath={currentPath}
                  viewport={viewport}
                  reducedMotionOverride={simulateReducedMotion}
                />
              ) : null}
            </div>

            {resolvedPreview ? (
              <ExperienceHeroSlot
                experience={resolvedPreview}
                currentPath={currentPath}
                viewport={viewport}
                reducedMotionOverride={simulateReducedMotion}
              />
            ) : null}

            <main>
              {previewRoute === "home" ? (
                homeNodes.length > 0 ? (
                  <PageRenderer
                    nodes={homeNodes}
                    mode="live"
                    viewport={viewport}
                    forceViewport={viewport}
                    typography={baseThemeTokens?.typography}
                    globalMotion={baseThemeTokens?.motion}
                    catalog={catalog}
                    categories={categories}
                    onNotify={onNotify}
                  />
                ) : (
                  <div className="exp-empty-stage">
                    <Layers size={28} />
                    <strong>Storefront Home Preview</strong>
                    <p>Drag seasonal effects here to preview live layers.</p>
                  </div>
                )
              ) : previewRoute === "shop" ? (
                <ShopPreviewFallback catalog={catalog} />
              ) : (
                <ProductPreviewFallback catalog={catalog} />
              )}
            </main>

            {resolvedPreview ? (
              <ExperienceFooterSlot
                experience={resolvedPreview}
                currentPath={currentPath}
                viewport={viewport}
                reducedMotionOverride={simulateReducedMotion}
              />
            ) : null}

            <StoreFooter preview footerConfig={baseThemeTokens?.footer} />

            {resolvedPreview ? (
              <ExperienceOverlayRuntime
                experience={resolvedPreview}
                currentPath={currentPath}
                contained
                pausedOverride={effectsPaused}
                reducedMotionOverride={simulateReducedMotion}
                viewport={viewport}
              />
            ) : null}

            {activePaletteDrag ? (
              <div className="exp-drop-zones-overlay">
                {ALL_DROP_ZONES.map((zone) => (
                  <StudioZoneDropTarget
                    key={zone}
                    zone={zone}
                    activeDrag={activePaletteDrag}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {canUseAi && canWrite ? <ExperienceAiBar onNotify={onNotify} /> : null}
    </main>
  );
}
