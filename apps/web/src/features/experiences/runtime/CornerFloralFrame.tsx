"use client";

import type { ResolvedExperienceLayerDto } from "../types";

type CornerPos = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const CORNER_TRANSFORMS: Record<CornerPos, string> = {
  "top-left": "scale(1, 1)",
  "top-right": "scale(-1, 1)",
  "bottom-left": "scale(1, -1)",
  "bottom-right": "scale(-1, -1)",
};

export function CornerFloralFrame({
  layer,
  reducedMotion = false,
  contained = false,
}: {
  layer: ResolvedExperienceLayerDto;
  reducedMotion?: boolean;
  contained?: boolean;
}) {
  const p = layer.props || {};
  const motif = typeof p.motif === "string" ? p.motif : "peach_branch";
  const corners: CornerPos[] = Array.isArray(p.corners) && p.corners.length
    ? (p.corners as CornerPos[])
    : ["top-left", "top-right"];
  const scale = typeof p.scale === "number" ? p.scale : 1;
  const sway = p.sway !== false && !reducedMotion;
  const primaryColor = typeof p.primaryColor === "string" ? p.primaryColor : "#F472B6";
  const accentColor = typeof p.accentColor === "string" ? p.accentColor : "#FACC15";

  return (
    <div
      aria-hidden="true"
      className={contained ? "exp-corners-layer is-contained" : "exp-corners-layer"}
      style={{ opacity: layer.opacity }}
    >
      {corners.map((corner) => (
        <div
          key={corner}
          className={`exp-corner-item pos-${corner}${sway ? " is-swaying" : ""}`}
          style={{
            transform: `${CORNER_TRANSFORMS[corner] || ""} scale(${scale})`,
          }}
        >
          {motif === "gold_deco" ? (
            <svg viewBox="0 0 140 140" width="136" height="136" fill="none">
              <path d="M8 8 H126 M8 8 V126" stroke={primaryColor} strokeWidth="2.4" />
              <path d="M18 18 H94 M18 18 V94" stroke={accentColor} strokeWidth="1.4" opacity="0.85" />
              <path d="M8 46 L46 8 M8 74 L74 8" stroke={primaryColor} strokeWidth="1.4" opacity="0.7" />
              <polygon points="24,24 34,18 30,30 18,34" fill={accentColor} />
            </svg>
          ) : motif === "spiderweb_gothic" ? (
            <svg viewBox="0 0 140 140" width="136" height="136" fill="none">
              <path
                d="M0 0 L132 22 M0 0 L108 66 M0 0 L66 108 M0 0 L22 132"
                stroke={primaryColor}
                strokeWidth="1.4"
                opacity="0.72"
              />
              <path
                d="M28 5 Q22 22 5 28 M58 10 Q42 42 10 58 M90 15 Q62 62 15 90 M120 20 Q80 80 20 120"
                stroke={accentColor}
                strokeWidth="1.2"
                opacity="0.6"
              />
            </svg>
          ) : motif === "pine_holly" ? (
            <svg viewBox="0 0 150 150" width="142" height="142" fill="none">
              <path
                d="M0 14 Q48 18 96 6 M0 28 Q38 42 74 34 M12 0 Q20 48 6 98"
                stroke="#14532D"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <ellipse cx="42" cy="18" rx="18" ry="8" transform="rotate(-12 42 18)" fill={primaryColor} />
              <ellipse cx="74" cy="14" rx="16" ry="7" transform="rotate(-18 74 14)" fill="#16A34A" />
              <ellipse cx="20" cy="48" rx="8" ry="18" transform="rotate(14 20 48)" fill={primaryColor} />
              <ellipse cx="48" cy="36" rx="14" ry="7" transform="rotate(24 48 36)" fill="#166534" />
              <circle cx="28" cy="24" r="5" fill={accentColor} />
              <circle cx="38" cy="28" r="4.5" fill={accentColor} />
              <circle cx="29" cy="34" r="4.5" fill={accentColor} />
            </svg>
          ) : (
            // peach_branch, apricot_branch, cherry_branch, romantic_floral
            <svg viewBox="0 0 160 160" width="150" height="150" fill="none">
              <path
                d="M-4 18 Q52 24 108 10 M38 20 Q56 44 82 54 M12 18 Q18 58 8 104"
                stroke="#78350F"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              {[
                { cx: 34, cy: 20, r: 9 },
                { cx: 68, cy: 16, r: 10 },
                { cx: 104, cy: 12, r: 8 },
                { cx: 64, cy: 48, r: 9 },
                { cx: 18, cy: 62, r: 9.5 },
                { cx: 12, cy: 96, r: 7.5 },
              ].map((fl, i) => (
                <g key={i} transform={`translate(${fl.cx}, ${fl.cy})`}>
                  {[0, 72, 144, 216, 288].map((deg) => (
                    <ellipse
                      key={deg}
                      cx="0"
                      cy={-fl.r * 0.55}
                      rx={fl.r * 0.42}
                      ry={fl.r * 0.58}
                      transform={`rotate(${deg})`}
                      fill={primaryColor}
                      opacity="0.92"
                    />
                  ))}
                  <circle cx="0" cy="0" r={fl.r * 0.28} fill={accentColor} />
                </g>
              ))}
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
