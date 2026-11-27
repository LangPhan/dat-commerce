"use client";

import type { ResolvedExperienceLayerDto } from "../types";

export function StringLightsBar({
  layer,
  reducedMotion = false,
}: {
  layer: ResolvedExperienceLayerDto;
  reducedMotion?: boolean;
}) {
  const p = layer.props || {};
  const style = typeof p.style === "string" ? p.style : "christmas_bulbs";
  const bulbCount = typeof p.bulbCount === "number" ? Math.max(8, Math.min(48, p.bulbCount)) : 22;
  const twinkleSpeed = typeof p.twinkleSpeed === "number" ? Math.max(0.3, p.twinkleSpeed) : 1.1;
  const glowIntensity = typeof p.glowIntensity === "number" ? p.glowIntensity : 0.8;
  const wireColor = typeof p.wireColor === "string" ? p.wireColor : "#1E293B";
  const colors = Array.isArray(p.colors) && p.colors.length
    ? (p.colors as string[])
    : style === "warm_fairy"
      ? ["#FEF08A", "#FDE047", "#FDBA74"]
      : style === "icicle_lights"
        ? ["#E0F2FE", "#BAE6FD", "#FFFFFF"]
        : ["#EF4444", "#22C55E", "#FACC15", "#3B82F6"];

  const viewWidth = 1200;
  const step = viewWidth / bulbCount;
  const bulbs = Array.from({ length: bulbCount }, (_, i) => {
    const x = step * (i + 0.5);
    const sag = Math.sin(((i % 4) / 4) * Math.PI) * 8;
    const y = 8 + sag;
    const color = colors[i % colors.length];
    return { x, y, color, i };
  });

  const wirePath = bulbs
    .map((b, idx) => `${idx === 0 ? "M 0 4 L" : "L"} ${b.x.toFixed(1)} ${(b.y - 3).toFixed(1)}`)
    .join(" ") + ` L ${viewWidth} 4`;

  return (
    <div
      aria-hidden="true"
      className="exp-string-lights"
      style={{ opacity: layer.opacity }}
    >
      <svg
        viewBox={`0 0 ${viewWidth} 36`}
        preserveAspectRatio="none"
        className="exp-string-lights-svg"
      >
        <path d={wirePath} fill="none" stroke={wireColor} strokeWidth="2" opacity="0.85" />
        {bulbs.map((b) => {
          const durationSec = (1.8 / twinkleSpeed).toFixed(2);
          const delaySec = ((b.i % 5) * 0.28).toFixed(2);
          const isIcicle = style === "icicle_lights";
          return (
            <g key={b.i}>
              <rect
                x={b.x - 2.2}
                y={b.y - 4}
                width="4.4"
                height="4.5"
                rx="1"
                fill={wireColor}
              />
              {isIcicle ? (
                <polygon
                  points={`${b.x - 3},${b.y + 1} ${b.x + 3},${b.y + 1} ${b.x},${b.y + 17 + (b.i % 3) * 4}`}
                  fill={b.color}
                  className={reducedMotion ? undefined : "exp-bulb-twinkle"}
                  style={{
                    animationDuration: `${durationSec}s`,
                    animationDelay: `${delaySec}s`,
                    filter: `drop-shadow(0 0 ${Math.round(8 * glowIntensity)}px ${b.color})`,
                  }}
                />
              ) : (
                <ellipse
                  cx={b.x}
                  cy={b.y + 7}
                  rx={style === "warm_fairy" ? 3.5 : 5}
                  ry={style === "warm_fairy" ? 4.5 : 7}
                  fill={b.color}
                  className={reducedMotion ? undefined : "exp-bulb-twinkle"}
                  style={{
                    animationDuration: `${durationSec}s`,
                    animationDelay: `${delaySec}s`,
                    filter: `drop-shadow(0 0 ${Math.round(10 * glowIntensity)}px ${b.color})`,
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
