"use client";

import type { ResolvedExperienceLayerDto } from "../types";

export function FestiveLanternsBar({
  layer,
  reducedMotion = false,
}: {
  layer: ResolvedExperienceLayerDto;
  reducedMotion?: boolean;
}) {
  const p = layer.props || {};
  const count = typeof p.count === "number" ? Math.max(2, Math.min(12, p.count)) : 6;
  const swayIntensity = typeof p.swayIntensity === "number" ? p.swayIntensity : 1;
  const primaryColor = typeof p.primaryColor === "string" ? p.primaryColor : "#DC2626";
  const trimColor = typeof p.trimColor === "string" ? p.trimColor : "#FACC15";
  const emblemText = typeof p.emblemText === "string" ? p.emblemText : "福";

  // Position half on left side, half on right side so center nav stays uncluttered
  const half = Math.ceil(count / 2);
  const lanterns = Array.from({ length: count }, (_, idx) => {
    const isLeft = idx < half;
    const posIndex = isLeft ? idx : idx - half;
    const pct = isLeft ? 4 + posIndex * 7.5 : 96 - posIndex * 7.5;
    const cordHeight = 14 + (idx % 2) * 14;
    return { idx, pct, cordHeight };
  });

  return (
    <div
      aria-hidden="true"
      className="exp-lanterns-bar"
      style={{ opacity: layer.opacity }}
    >
      {lanterns.map((item) => (
        <div
          key={item.idx}
          className={reducedMotion || swayIntensity === 0 ? "exp-lantern-wrap" : "exp-lantern-wrap is-swaying"}
          style={{
            left: `${item.pct}%`,
            animationDelay: `${(item.idx * 0.35).toFixed(2)}s`,
            animationDuration: `${(3.8 / Math.max(0.3, swayIntensity)).toFixed(2)}s`,
          }}
        >
          <svg
            viewBox="0 0 46 84"
            width="38"
            height={54 + item.cordHeight}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Hanging cord */}
            <line x1="23" y1="0" x2="23" y2="14" stroke={trimColor} strokeWidth="2" />
            {/* Top gold cap */}
            <rect x="15" y="13" width="16" height="4" rx="1.5" fill={trimColor} />
            {/* Silk Lantern Body */}
            <ellipse
              cx="23"
              cy="34"
              rx="17"
              ry="19"
              fill={primaryColor}
              stroke={trimColor}
              strokeWidth="1.8"
            />
            {/* Inner glow */}
            <ellipse cx="23" cy="34" rx="11" ry="14" fill="#FDE047" opacity="0.22" />
            {/* Vertical ribs */}
            <ellipse cx="23" cy="34" rx="8" ry="19" stroke={trimColor} strokeWidth="0.9" opacity="0.55" />
            {/* Auspicious character */}
            {emblemText ? (
              <text
                x="23"
                y="39"
                textAnchor="middle"
                fill={trimColor}
                fontSize="13"
                fontWeight="700"
              >
                {emblemText}
              </text>
            ) : null}
            {/* Bottom gold cap */}
            <rect x="16" y="51" width="14" height="4" rx="1.5" fill={trimColor} />
            {/* Tassels */}
            <path
              d="M19 55 L17 78 M23 55 L23 81 M27 55 L29 78"
              stroke={trimColor}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
