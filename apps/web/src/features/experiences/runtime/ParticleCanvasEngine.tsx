"use client";

import { useEffect, useRef } from "react";
import type { ResolvedExperienceLayerDto } from "../types";

type CanvasLayerKind =
  | "snowfall"
  | "blossom_petals"
  | "floating_hearts"
  | "golden_particles"
  | "fireworks"
  | "confetti_burst";

type Particle = {
  layerIdx: number;
  kind: CanvasLayerKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  phase: number;
  rot: number;
  rotSpeed: number;
  tilt: number;
  tiltSpeed: number;
  shape: string;
  glow: boolean;
  life: number;
  maxLife: number;
  trail?: { x: number; y: number }[];
};

type Rocket = {
  layerIdx: number;
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
  colors: string[];
  particleCount: number;
  gravity: number;
  trails: boolean;
  opacity: number;
};

function numProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const v = props[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function strProp(props: Record<string, unknown>, key: string, fallback: string): string {
  const v = props[key];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function arrProp(props: Record<string, unknown>, key: string, fallback: string[]): string[] {
  const v = props[key];
  if (Array.isArray(v) && v.length > 0) {
    const clean = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    if (clean.length > 0) return clean;
  }
  return fallback;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function ParticleCanvasEngine({
  layers,
  contained = false,
  paused = false,
  reducedMotion = false,
  mobileDensityRatio = 0.5,
  pauseOnHiddenTab = true,
}: {
  layers: ResolvedExperienceLayerDto[];
  contained?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
  mobileDensityRatio?: number;
  pauseOnHiddenTab?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let rafId = 0;
    let lastTs = 0;
    let tabHidden = typeof document !== "undefined" ? document.hidden : false;

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    const fireworkTimers: number[] = [];

    const resize = () => {
      const rect = contained && canvas.parentElement
        ? canvas.parentElement.getBoundingClientRect()
        : { width: window.innerWidth, height: window.innerHeight };
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const observer =
      contained && canvas.parentElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : null;
    if (observer && canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }
    window.addEventListener("resize", resize);

    const onVisibilityChange = () => {
      tabHidden = document.hidden;
      if (!tabHidden) lastTs = performance.now();
    };
    if (pauseOnHiddenTab) {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    const spawnParticle = (
      layer: ResolvedExperienceLayerDto,
      layerIdx: number,
      randomY: boolean
    ): Particle => {
      const p = layer.props || {};
      const kind = layer.type as CanvasLayerKind;
      const speed = numProp(p, "speed", 1.0);

      if (kind === "snowfall") {
        const sizeMin = numProp(p, "sizeMin", 2);
        const sizeMax = Math.max(sizeMin + 0.5, numProp(p, "sizeMax", 7.5));
        const variant = strProp(p, "variant", "mixed");
        const shape =
          variant === "mixed"
            ? Math.random() < 0.35
              ? "crystal"
              : "bokeh"
            : variant === "crystal_flakes"
              ? "crystal"
              : "bokeh";
        return {
          layerIdx,
          kind,
          x: Math.random() * width,
          y: randomY ? Math.random() * height : -randRange(5, 28),
          vx: numProp(p, "wind", 0.35) * randRange(0.4, 1.3),
          vy: randRange(0.7, 1.9) * speed,
          size: randRange(sizeMin, sizeMax),
          color: strProp(p, "color", "#FFFFFF"),
          alpha: randRange(0.45, 0.95) * layer.opacity,
          phase: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: randRange(-0.02, 0.02),
          tilt: 0,
          tiltSpeed: 0,
          shape,
          glow: shape === "bokeh",
          life: 0,
          maxLife: 99999,
        };
      }

      if (kind === "blossom_petals") {
        const colors = arrProp(p, "colors", ["#FBCFE8", "#F9A8D4", "#FDF2F8"]);
        const species = strProp(p, "species", "cherry_blossom");
        return {
          layerIdx,
          kind,
          x: Math.random() * width,
          y: randomY ? Math.random() * height : -randRange(8, 36),
          vx: randRange(-0.35, 0.65),
          vy: randRange(0.9, 1.85) * speed,
          size: randRange(6, 13),
          color: pickRandom(colors),
          alpha: randRange(0.72, 0.96) * layer.opacity,
          phase: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: randRange(-0.03, 0.03),
          tilt: Math.random() * Math.PI,
          tiltSpeed: randRange(0.02, 0.06),
          shape: species,
          glow: false,
          life: 0,
          maxLife: 99999,
        };
      }

      if (kind === "floating_hearts") {
        const colors = arrProp(p, "colors", ["#FB7185", "#F43F5E", "#FDA4AF"]);
        const direction = strProp(p, "direction", "rise");
        const vy = direction === "rise" ? -randRange(0.7, 1.6) * speed : randRange(-0.35, 0.35) * speed;
        return {
          layerIdx,
          kind,
          x: Math.random() * width,
          y: randomY ? Math.random() * height : direction === "rise" ? height + randRange(10, 40) : Math.random() * height,
          vx: randRange(-0.3, 0.3),
          vy,
          size: randRange(7, 15),
          color: pickRandom(colors),
          alpha: randRange(0.55, 0.92) * layer.opacity,
          phase: Math.random() * Math.PI * 2,
          rot: randRange(-0.25, 0.25),
          rotSpeed: randRange(-0.008, 0.008),
          tilt: 0,
          tiltSpeed: 0,
          shape: "heart",
          glow: p.glow !== false,
          life: 0,
          maxLife: 99999,
        };
      }

      if (kind === "golden_particles") {
        const colors = arrProp(p, "colors", ["#FACC15", "#FDE047", "#D97706"]);
        return {
          layerIdx,
          kind,
          x: Math.random() * width,
          y: randomY ? Math.random() * height : Math.random() * height,
          vx: randRange(-0.25, 0.25) * speed,
          vy: -randRange(0.2, 0.75) * speed,
          size: randRange(2.5, 6.5),
          color: pickRandom(colors),
          alpha: randRange(0.4, 0.95) * layer.opacity,
          phase: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI,
          rotSpeed: randRange(-0.015, 0.015),
          tilt: 0,
          tiltSpeed: p.twinkle !== false ? randRange(0.04, 0.09) : 0,
          shape: strProp(p, "shape", "sparkle_star"),
          glow: true,
          life: 0,
          maxLife: 99999,
        };
      }

      // confetti_burst
      const colors = arrProp(p, "colors", ["#F43F5E", "#FACC15", "#3B82F6", "#10B981"]);
      const shapes = arrProp(p, "shapes", ["ribbon", "circle", "star"]);
      return {
        layerIdx,
        kind,
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -randRange(8, 32),
        vx: randRange(-0.6, 0.6),
        vy: randRange(1.2, 2.5) * speed,
        size: randRange(4.5, 9),
        color: pickRandom(colors),
        alpha: randRange(0.7, 0.95) * layer.opacity,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: randRange(-0.08, 0.08),
        tilt: Math.random() * Math.PI,
        tiltSpeed: randRange(0.05, 0.12),
        shape: pickRandom(shapes),
        glow: false,
        life: 0,
        maxLife: 99999,
      };
    };

    const seedParticles = () => {
      particles.length = 0;
      rockets.length = 0;
      fireworkTimers.length = 0;
      const isMobile = width < 768;
      const activeLayers = layers;

      activeLayers.forEach((layer, layerIdx) => {
        if (layer.type === "fireworks") {
          fireworkTimers.push(0.25 + layerIdx * 0.4);
          return;
        }
        const rawDensity = numProp(layer.props, "density", 60);
        const scaled = Math.round(
          rawDensity *
            (layer.effectiveDensityScale ?? 1) *
            (isMobile ? Math.max(0.2, mobileDensityRatio) : 1) *
            (reducedMotion ? 0.25 : 1)
        );
        const count = Math.max(4, Math.min(220, scaled));
        for (let i = 0; i < count; i++) {
          particles.push(spawnParticle(layer, layerIdx, true));
        }
      });
    };

    seedParticles();

    const drawCrystalSnowflake = (x: number, y: number, r: number, rot: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r);
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(r * 0.28, -r * 0.78);
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(-r * 0.28, -r * 0.78);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawPetal = (pt: Particle) => {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      const scaleY = pt.kind === "blossom_petals" && pt.tiltSpeed ? Math.cos(pt.tilt) * 0.65 + 0.35 : 1;
      ctx.scale(1, Math.max(0.25, Math.abs(scaleY)));
      ctx.beginPath();
      const s = pt.size;
      if (pt.shape === "autumn_leaf") {
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.45, -s * 0.3);
        ctx.lineTo(s * 0.9, -s * 0.4);
        ctx.lineTo(s * 0.5, s * 0.2);
        ctx.lineTo(s * 0.65, s * 0.8);
        ctx.lineTo(0, s * 0.55);
        ctx.lineTo(-s * 0.65, s * 0.8);
        ctx.lineTo(-s * 0.5, s * 0.2);
        ctx.lineTo(-s * 0.9, -s * 0.4);
        ctx.lineTo(-s * 0.45, -s * 0.3);
        ctx.closePath();
      } else {
        // Dual-lobed sakura / peach / apricot petal with notch
        ctx.moveTo(0, s * 0.7);
        ctx.bezierCurveTo(s * 0.85, s * 0.35, s * 0.9, -s * 0.55, s * 0.22, -s * 0.85);
        ctx.lineTo(0, -s * 0.58);
        ctx.lineTo(-s * 0.22, -s * 0.85);
        ctx.bezierCurveTo(-s * 0.9, -s * 0.55, -s * 0.85, s * 0.35, 0, s * 0.7);
      }
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();
    };

    const drawHeart = (pt: Particle) => {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      const s = pt.size * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.75);
      ctx.bezierCurveTo(s * 1.4, -s * 0.1, s * 1.2, -s * 1.3, 0, -s * 0.45);
      ctx.bezierCurveTo(-s * 1.2, -s * 1.3, -s * 1.4, -s * 0.1, 0, s * 0.75);
      if (pt.glow) {
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();
    };

    const drawSparkle = (pt: Particle) => {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      const s = pt.size;
      if (pt.shape === "sparkle_star") {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.lineTo(0, -s * 1.3);
          ctx.lineTo(s * 0.25, -s * 0.25);
        }
        ctx.closePath();
      } else if (pt.shape === "diamond") {
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.65, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.65, 0);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
      }
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();
    };

    const burstRocket = (r: Rocket) => {
      for (let i = 0; i < r.particleCount; i++) {
        const angle = (Math.PI * 2 * i) / r.particleCount + randRange(-0.12, 0.12);
        const speed = randRange(1.5, 5.2);
        particles.push({
          layerIdx: r.layerIdx,
          kind: "fireworks",
          x: r.x,
          y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: randRange(1.8, 3.6),
          color: Math.random() < 0.7 ? r.color : pickRandom(r.colors),
          alpha: r.opacity,
          phase: r.gravity,
          rot: 0,
          rotSpeed: 0,
          tilt: 0,
          tiltSpeed: 0,
          shape: "spark",
          glow: true,
          life: 0,
          maxLife: randRange(42, 74),
          trail: r.trails ? [] : undefined,
        });
      }
    };

    const renderFrame = (ts: number) => {
      const dt = lastTs ? Math.min(2.5, (ts - lastTs) / 16.667) : 1;
      lastTs = ts;

      ctx.clearRect(0, 0, width, height);

      if (!paused && !(pauseOnHiddenTab && tabHidden)) {
        const activeLayers = layers;

        // Launch fireworks rockets
        if (!reducedMotion) {
          activeLayers.forEach((layer, idx) => {
            if (layer.type !== "fireworks") return;
            const rate = numProp(layer.props, "burstRate", 0.85);
            fireworkTimers[idx] = (fireworkTimers[idx] ?? 0.5) - (dt * 0.0167) * rate;
            if (fireworkTimers[idx] <= 0 && rockets.length < 6) {
              fireworkTimers[idx] = randRange(0.75, 1.85);
              const colors = arrProp(layer.props, "colors", ["#EF4444", "#FACC15", "#FB923C"]);
              const launchZone = strProp(layer.props, "launchZone", "top_sky");
              rockets.push({
                layerIdx: idx,
                x: randRange(width * 0.14, width * 0.86),
                y: launchZone === "top_sky" ? height * 0.65 : height * 0.92,
                vy: -randRange(6.5, 9.5),
                targetY: randRange(height * 0.12, launchZone === "top_sky" ? height * 0.36 : height * 0.55),
                color: pickRandom(colors),
                colors,
                particleCount: Math.round(
                  numProp(layer.props, "particleCount", 54) * (width < 768 ? 0.6 : 1)
                ),
                gravity: numProp(layer.props, "gravity", 0.45),
                trails: layer.props.trails !== false,
                opacity: layer.opacity,
              });
            }
          });
        }

        // Update rockets
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.y += r.vy * dt;
          r.vy *= 0.985;
          ctx.save();
          ctx.fillStyle = r.color;
          ctx.shadowColor = r.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (r.y <= r.targetY || r.vy > -1.2) {
            burstRocket(r);
            rockets.splice(i, 1);
          }
        }

        // Update & draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const pt = particles[i];
          const layer = activeLayers[pt.layerIdx];

          if (pt.kind === "fireworks") {
            pt.life += dt;
            if (pt.life >= pt.maxLife) {
              particles.splice(i, 1);
              continue;
            }
            if (pt.trail) {
              pt.trail.push({ x: pt.x, y: pt.y });
              if (pt.trail.length > 5) pt.trail.shift();
            }
            pt.vx *= 0.97;
            pt.vy = pt.vy * 0.97 + pt.phase * 0.12 * dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            const fade = Math.max(0, 1 - pt.life / pt.maxLife);

            ctx.save();
            ctx.globalAlpha = pt.alpha * fade;
            ctx.globalCompositeOperation = "lighter";
            if (pt.trail && pt.trail.length > 1) {
              ctx.strokeStyle = pt.color;
              ctx.lineWidth = pt.size * 0.7;
              ctx.beginPath();
              ctx.moveTo(pt.trail[0].x, pt.trail[0].y);
              for (let t = 1; t < pt.trail.length; t++) {
                ctx.lineTo(pt.trail[t].x, pt.trail[t].y);
              }
              ctx.stroke();
            }
            ctx.fillStyle = pt.color;
            ctx.shadowColor = pt.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * fade, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            continue;
          }

          if (!reducedMotion) {
            pt.phase += 0.025 * dt;
            pt.rot += pt.rotSpeed * dt;
            pt.tilt += pt.tiltSpeed * dt;

            if (pt.kind === "blossom_petals") {
              const amp = layer ? numProp(layer.props, "swayAmplitude", 1.2) : 1.2;
              pt.x += (pt.vx + Math.sin(pt.phase) * 0.75 * amp) * dt;
              pt.y += pt.vy * dt;
            } else if (pt.kind === "snowfall") {
              pt.x += (pt.vx + Math.sin(pt.phase) * 0.45) * dt;
              pt.y += pt.vy * dt;
            } else if (pt.kind === "floating_hearts") {
              pt.x += (pt.vx + Math.sin(pt.phase) * 0.45) * dt;
              pt.y += pt.vy * dt;
            } else {
              pt.x += pt.vx * dt;
              pt.y += pt.vy * dt;
            }

            // Wrap boundaries
            if (pt.y > height + 30) {
              pt.y = -20;
              pt.x = Math.random() * width;
            } else if (pt.y < -30) {
              pt.y = height + 20;
              pt.x = Math.random() * width;
            }
            if (pt.x > width + 30) pt.x = -20;
            else if (pt.x < -30) pt.x = width + 20;
          }

          const twinkleAlpha =
            pt.kind === "golden_particles" && pt.tiltSpeed > 0
              ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(pt.tilt * 2))
              : 1;

          ctx.save();
          ctx.globalAlpha = Math.max(0.05, Math.min(1, pt.alpha * twinkleAlpha));
          if (layer?.blendMode === "screen") {
            ctx.globalCompositeOperation = "screen";
          } else if (layer?.blendMode === "lighter") {
            ctx.globalCompositeOperation = "lighter";
          }

          if (pt.kind === "snowfall") {
            if (pt.shape === "crystal") {
              ctx.strokeStyle = pt.color;
              drawCrystalSnowflake(pt.x, pt.y, pt.size, pt.rot);
            } else {
              ctx.fillStyle = pt.color;
              ctx.shadowColor = pt.color;
              ctx.shadowBlur = pt.size * 1.4;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, pt.size * 0.55, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (pt.kind === "blossom_petals") {
            drawPetal(pt);
          } else if (pt.kind === "floating_hearts") {
            drawHeart(pt);
          } else if (pt.kind === "golden_particles") {
            drawSparkle(pt);
          } else if (pt.kind === "confetti_burst") {
            ctx.translate(pt.x, pt.y);
            ctx.rotate(pt.rot);
            ctx.scale(1, Math.max(0.25, Math.abs(Math.cos(pt.tilt))));
            ctx.fillStyle = pt.color;
            if (pt.shape === "circle") {
              ctx.beginPath();
              ctx.arc(0, 0, pt.size * 0.45, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillRect(-pt.size * 0.6, -pt.size * 0.28, pt.size * 1.2, pt.size * 0.56);
            }
          }
          ctx.restore();
        }
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    if (reducedMotion) {
      renderFrame(performance.now());
    } else {
      rafId = window.requestAnimationFrame(renderFrame);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      if (pauseOnHiddenTab) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [layers, contained, paused, reducedMotion, mobileDensityRatio, pauseOnHiddenTab]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={contained ? "exp-particle-canvas is-contained" : "exp-particle-canvas"}
    />
  );
}
