"use client";

import { Flame, Gift, Heart, Snowflake, Sparkles, Tag } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { ResolvedExperienceLayerDto } from "../types";

const STICKER_ICONS = {
  sparkles: Sparkles,
  flame: Flame,
  gift: Gift,
  heart: Heart,
  snowflake: Snowflake,
  tag: Tag,
};

export function FloatingStickerBadge({
  layer,
  reducedMotion = false,
  contained = false,
}: {
  layer: ResolvedExperienceLayerDto;
  reducedMotion?: boolean;
  contained?: boolean;
}) {
  const p = layer.props || {};
  const text = typeof p.text === "string" ? p.text : "SPECIAL";
  const subtext = typeof p.subtext === "string" ? p.subtext : "";
  const iconKey = (typeof p.icon === "string" ? p.icon : "sparkles") as keyof typeof STICKER_ICONS;
  const Icon = STICKER_ICONS[iconKey] || Sparkles;
  const anchor = typeof p.anchor === "string" ? p.anchor : "bottom-left";
  const offsetX = typeof p.offsetX === "number" ? p.offsetX : 2;
  const offsetY = typeof p.offsetY === "number" ? p.offsetY : 10;
  const bgColor = typeof p.bgColor === "string" ? p.bgColor : "#DC2626";
  const textColor = typeof p.textColor === "string" ? p.textColor : "#FFFFFF";
  const motion = reducedMotion ? "none" : typeof p.motion === "string" ? p.motion : "float";
  const linkUrl = typeof p.linkUrl === "string" ? p.linkUrl : "";

  const posStyle: CSSProperties = {
    backgroundColor: bgColor,
    color: textColor,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
  };
  if (anchor.includes("top")) posStyle.top = `${offsetY}%`;
  else posStyle.bottom = `${offsetY}%`;
  if (anchor.includes("left")) posStyle.left = `${offsetX}%`;
  else posStyle.right = `${offsetX}%`;

  const inner = (
    <span className="exp-sticker-inner">
      <Icon size={15} aria-hidden="true" />
      <span className="exp-sticker-copy">
        <strong>{text}</strong>
        {subtext ? <small>{subtext}</small> : null}
      </span>
    </span>
  );

  const cls = `${contained ? "exp-floating-sticker is-contained" : "exp-floating-sticker"} motion-${motion}`;

  if (linkUrl) {
    return (
      <Link href={linkUrl} className={cls} style={posStyle}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} style={posStyle}>
      {inner}
    </div>
  );
}
