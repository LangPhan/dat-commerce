"use client";

import { ArrowRight, Check, Copy, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ResolvedExperienceLayerDto } from "../types";

export function SeasonalPromoBanner({
  layer,
  reducedMotion = false,
  onDismiss,
}: {
  layer: ResolvedExperienceLayerDto;
  reducedMotion?: boolean;
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const p = layer.props || {};

  const badgeText = typeof p.badgeText === "string" ? p.badgeText : "";
  const headline = typeof p.headline === "string" ? p.headline : "";
  const subtext = typeof p.subtext === "string" ? p.subtext : "";
  const promoCode = typeof p.promoCode === "string" ? p.promoCode : "";
  const ctaLabel = typeof p.ctaLabel === "string" ? p.ctaLabel : "";
  const ctaUrl = typeof p.ctaUrl === "string" && p.ctaUrl ? p.ctaUrl : "/store/shop";
  const bgColor = typeof p.bgColor === "string" ? p.bgColor : "#18181B";
  const textColor = typeof p.textColor === "string" ? p.textColor : "#FFFFFF";
  const accentColor = typeof p.accentColor === "string" ? p.accentColor : "#FACC15";
  const animationStyle = typeof p.animationStyle === "string" ? p.animationStyle : "shimmer";
  const dismissible = Boolean(p.dismissible);

  const handleCopy = () => {
    if (!promoCode) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(promoCode);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={`exp-promo-banner anim-${reducedMotion ? "none" : animationStyle}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        opacity: layer.opacity,
        ["--exp-banner-accent" as string]: accentColor,
      }}
      role="region"
      aria-label={headline || badgeText || "Seasonal promotion"}
    >
      <div className="exp-promo-inner">
        {badgeText ? (
          <span
            className="exp-promo-badge"
            style={{ backgroundColor: accentColor, color: bgColor }}
          >
            <Sparkles size={11} aria-hidden="true" />
            {badgeText}
          </span>
        ) : null}

        <div className="exp-promo-copy">
          <strong>{headline}</strong>
          {subtext ? <span className="exp-promo-sub">{subtext}</span> : null}
        </div>

        <div className="exp-promo-actions">
          {promoCode ? (
            <button
              type="button"
              className="exp-promo-code-btn"
              onClick={handleCopy}
              title="Copy promo code"
              style={{ borderColor: `${accentColor}88`, color: accentColor }}
            >
              <span>{promoCode}</span>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          ) : null}

          {ctaLabel ? (
            <Link
              href={ctaUrl}
              className="exp-promo-cta"
              style={{ backgroundColor: accentColor, color: bgColor }}
            >
              <span>{ctaLabel}</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          ) : null}

          {dismissible && onDismiss ? (
            <button
              type="button"
              className="exp-promo-dismiss"
              aria-label="Dismiss promotional banner"
              onClick={onDismiss}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
