"use client";

import { motion } from "motion/react";
import type { ResolvedExperienceLayerDto } from "../types";

export function SantaSleighScene({
  layer,
  reducedMotion = false,
  contained = false,
}: {
  layer: ResolvedExperienceLayerDto;
  reducedMotion?: boolean;
  contained?: boolean;
}) {
  const p = layer.props || {};
  const interval = typeof p.flightIntervalSeconds === "number" ? p.flightIntervalSeconds : 14;
  const duration = typeof p.flightDurationSeconds === "number" ? p.flightDurationSeconds : 9;
  const altitude = typeof p.altitudePct === "number" ? p.altitudePct : 12;
  const direction = p.direction === "rtl" ? "rtl" : "ltr";
  const scale = typeof p.scale === "number" ? p.scale : 1;
  const trailSparkles = p.trailSparkles !== false;
  const sleighColor = typeof p.sleighColor === "string" ? p.sleighColor : "#B91C1C";
  const glowColor = typeof p.glowColor === "string" ? p.glowColor : "#FDE047";

  const startX = direction === "ltr" ? "-28%" : "118%";
  const endX = direction === "ltr" ? "118%" : "-28%";
  const repeatDelay = Math.max(1, interval - duration);

  return (
    <div
      aria-hidden="true"
      className={contained ? "exp-santa-stage is-contained" : "exp-santa-stage"}
      style={{ opacity: layer.opacity }}
    >
      <motion.div
        className="exp-santa-carrier"
        style={{
          top: `${altitude}%`,
          transformOrigin: "center",
        }}
        initial={reducedMotion ? { left: "35%", y: 0 } : { left: startX, y: 0 }}
        animate={
          reducedMotion
            ? { left: "35%", y: 0 }
            : {
                left: [startX, endX],
                y: [0, -14, 6, -10, 0],
              }
        }
        transition={
          reducedMotion
            ? { duration: 0.2 }
            : {
                left: {
                  duration,
                  repeat: Infinity,
                  repeatDelay,
                  ease: "linear",
                },
                y: {
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }
        }
      >
        <div
          className="exp-santa-flip"
          style={{
            transform: `scale(${direction === "rtl" ? -scale : scale}, ${scale})`,
            filter: `drop-shadow(0 6px 14px ${glowColor}55)`,
          }}
        >
          {trailSparkles && !reducedMotion ? (
            <div className="exp-santa-sparkles" style={{ color: glowColor }}>
              <span className="exp-spark-dot d1">✦</span>
              <span className="exp-spark-dot d2">✧</span>
              <span className="exp-spark-dot d3">✦</span>
            </div>
          ) : null}

          <svg
            viewBox="0 0 360 92"
            width="280"
            height="72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Reins */}
            <path
              d="M116 44 Q185 52 294 34"
              stroke={glowColor}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.85"
            />
            {/* Sleigh Runner */}
            <path
              d="M22 76 H112 C124 76 130 66 124 60"
              stroke={glowColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path d="M40 76 V64 M92 76 V64" stroke={glowColor} strokeWidth="2.5" />
            {/* Sleigh Body */}
            <path
              d="M26 42 C30 64 56 66 106 64 L116 44 C104 42 96 46 86 48 C68 50 48 44 26 42 Z"
              fill={sleighColor}
              stroke={glowColor}
              strokeWidth="2"
            />
            {/* Gift Sack */}
            <circle cx="52" cy="36" r="13" fill="#15803D" />
            <rect x="44" y="25" width="16" height="8" rx="2" fill="#FACC15" />
            {/* Santa */}
            <circle cx="78" cy="36" r="10" fill={sleighColor} />
            <circle cx="80" cy="24" r="6.5" fill="#FED7AA" />
            <path d="M74 26 C77 32 84 32 86 25" fill="#FFFFFF" />
            <path d="M72 20 C76 10 85 11 88 20 Z" fill={sleighColor} />
            <circle cx="72" cy="18" r="2.8" fill="#FFFFFF" />

            {/* Reindeer 1 (Back) */}
            <g transform="translate(175, 22)">
              <ellipse cx="26" cy="24" rx="14" ry="8" fill="#78350F" />
              <path d="M36 20 L44 10 L50 12 L42 24 Z" fill="#92400E" />
              <circle cx="49" cy="12" r="2" fill="#1E293B" />
              <path d="M42 10 L40 2 M44 10 L47 2" stroke="#D97706" strokeWidth="1.6" />
              <path d="M18 30 L12 44 M24 31 L26 45 M34 29 L42 42" stroke="#78350F" strokeWidth="2.4" strokeLinecap="round" />
            </g>

            {/* Reindeer 2 (Middle) */}
            <g transform="translate(232, 18)">
              <ellipse cx="26" cy="24" rx="14" ry="8" fill="#92400E" />
              <path d="M36 20 L44 10 L50 12 L42 24 Z" fill="#92400E" />
              <circle cx="49" cy="12" r="2" fill="#1E293B" />
              <path d="M42 10 L40 2 M44 10 L47 2" stroke="#D97706" strokeWidth="1.6" />
              <path d="M18 30 L10 43 M24 31 L27 44 M34 29 L44 41" stroke="#92400E" strokeWidth="2.4" strokeLinecap="round" />
            </g>

            {/* Rudolph (Lead) */}
            <g transform="translate(288, 14)">
              <ellipse cx="26" cy="24" rx="14" ry="8" fill="#78350F" />
              <path d="M36 20 L44 10 L51 12 L42 24 Z" fill="#92400E" />
              <circle cx="51" cy="12" r="3" fill="#EF4444" />
              <circle cx="51" cy="12" r="6" fill="#EF4444" opacity="0.35" />
              <path d="M42 10 L39 1 M44 10 L48 1" stroke="#FACC15" strokeWidth="1.8" />
              <path d="M18 30 L12 44 M24 31 L26 45 M34 29 L44 42" stroke="#78350F" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      </motion.div>
    </div>
  );
}
