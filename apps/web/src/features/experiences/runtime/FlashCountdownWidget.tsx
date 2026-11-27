"use client";

import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResolvedExperienceLayerDto } from "../types";

type TimeParts = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  urgent: boolean;
  expired: boolean;
};

function computeParts(targetMs: number, nowMs: number): TimeParts {
  const diff = Math.max(0, targetMs - nowMs);
  if (diff <= 0) {
    return { days: "00", hours: "00", minutes: "00", seconds: "00", urgent: false, expired: true };
  }
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    days: String(d).padStart(2, "0"),
    hours: String(h).padStart(2, "0"),
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
    urgent: totalSec <= 3600,
    expired: false,
  };
}

export function FlashCountdownWidget({
  layer,
  reducedMotion = false,
}: {
  layer: ResolvedExperienceLayerDto;
  reducedMotion?: boolean;
}) {
  const p = layer.props || {};
  const title = typeof p.title === "string" ? p.title : "Flash Sale Ends In";
  const syncWithEnd = p.syncWithExperienceEnd !== false;
  const targetIsoProp = typeof p.targetIso === "string" ? p.targetIso : "";
  const effectiveIso =
    syncWithEnd && layer.experienceEndsAt
      ? layer.experienceEndsAt
      : targetIsoProp || layer.experienceEndsAt || "";

  const variant = typeof p.variant === "string" ? p.variant : "full_bar";
  const bgColor = typeof p.bgColor === "string" ? p.bgColor : "#991B1B";
  const textColor = typeof p.textColor === "string" ? p.textColor : "#FFFFFF";
  const digitBgColor = typeof p.digitBgColor === "string" ? p.digitBgColor : "#111827";
  const urgentColor = typeof p.urgentColor === "string" ? p.urgentColor : "#FACC15";
  const ctaLabel = typeof p.ctaLabel === "string" ? p.ctaLabel : "";
  const ctaUrl = typeof p.ctaUrl === "string" && p.ctaUrl ? p.ctaUrl : "/store/shop";

  // Hydration-safe initial placeholder, updated inside useEffect
  const [parts, setParts] = useState<TimeParts>({
    days: "00",
    hours: "06",
    minutes: "00",
    seconds: "00",
    urgent: false,
    expired: false,
  });

  useEffect(() => {
    const parsedTarget = effectiveIso ? Date.parse(effectiveIso) : NaN;
    // If unscheduled draft preview without explicit end date, show rolling 6h demo window
    const fallbackTarget = Number.isFinite(parsedTarget)
      ? parsedTarget
      : Date.now() + 6 * 3600 * 1000;

    const tick = () => setParts(computeParts(fallbackTarget, Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [effectiveIso]);

  return (
    <div
      className={`exp-countdown-bar variant-${variant}${parts.urgent && !reducedMotion ? " is-urgent" : ""}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        opacity: layer.opacity,
      }}
      role="timer"
      aria-label={title}
    >
      <div className="exp-countdown-inner">
        <div className="exp-countdown-title">
          <Flame size={15} style={{ color: urgentColor }} aria-hidden="true" />
          <span>{parts.expired ? `${title} · Ended` : title}</span>
        </div>

        <div className="exp-countdown-digits">
          {[
            { val: parts.days, unit: "D" },
            { val: parts.hours, unit: "H" },
            { val: parts.minutes, unit: "M" },
            { val: parts.seconds, unit: "S" },
          ].map((slot) => (
            <div
              key={slot.unit}
              className="exp-digit-box"
              style={{
                backgroundColor: digitBgColor,
                borderColor: parts.urgent ? urgentColor : "rgba(255,255,255,0.16)",
              }}
            >
              <strong style={{ color: parts.urgent ? urgentColor : textColor }}>
                {slot.val}
              </strong>
              <small>{slot.unit}</small>
            </div>
          ))}
        </div>

        {ctaLabel ? (
          <Link
            href={ctaUrl}
            className="exp-countdown-cta"
            style={{ backgroundColor: urgentColor, color: "#111827" }}
          >
            <span>{ctaLabel}</span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
