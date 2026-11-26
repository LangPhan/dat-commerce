import type { ScrollMotionConfig } from "./types";

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function computeScrollVariables(
  cfg: ScrollMotionConfig,
  rawProgress01: number
): Record<string, string> {
  const start = clamp01((cfg.start ?? 0) / 100);
  const end = clamp01((cfg.end ?? 100) / 100);
  const span = Math.max(0.01, end - start);
  let p = clamp01((rawProgress01 - start) / span);
  if (cfg.direction === "reverse") {
    p = 1 - p;
  }

  const effect = cfg.effect || "scrollFade";
  const intensity = cfg.intensity ?? cfg.speed ?? 30;
  const vars: Record<string, string> = {
    "--m-sc-tx": "0px",
    "--m-sc-ty": "0px",
    "--m-sc-scale": "1",
    "--m-sc-rot": "0deg",
    "--m-sc-skew": "0deg",
    "--m-sc-op": "1",
    "--m-sc-filter": "none",
    "--m-sc-bg-y": "50%",
  };

  switch (effect) {
    case "scrollFade":
      vars["--m-sc-op"] = lerp(cfg.min ?? 0.15, cfg.max ?? 1, p).toFixed(3);
      break;
    case "scrollSlide":
    case "revealBottom":
      vars["--m-sc-op"] = lerp(0.15, 1, p).toFixed(3);
      vars["--m-sc-ty"] = `${lerp(cfg.min ?? Math.max(24, intensity), cfg.max ?? 0, p).toFixed(1)}px`;
      break;
    case "revealTop":
      vars["--m-sc-op"] = lerp(0.15, 1, p).toFixed(3);
      vars["--m-sc-ty"] = `${lerp(cfg.min ?? -Math.max(24, intensity), cfg.max ?? 0, p).toFixed(1)}px`;
      break;
    case "revealLeft":
      vars["--m-sc-op"] = lerp(0.15, 1, p).toFixed(3);
      vars["--m-sc-tx"] = `${lerp(cfg.min ?? -Math.max(28, intensity), cfg.max ?? 0, p).toFixed(1)}px`;
      break;
    case "revealRight":
      vars["--m-sc-op"] = lerp(0.15, 1, p).toFixed(3);
      vars["--m-sc-tx"] = `${lerp(cfg.min ?? Math.max(28, intensity), cfg.max ?? 0, p).toFixed(1)}px`;
      break;
    case "scrollZoom":
      vars["--m-sc-op"] = lerp(0.2, 1, p).toFixed(3);
      vars["--m-sc-scale"] = lerp(cfg.min ?? 0.88, cfg.max ?? 1, p).toFixed(3);
      break;
    case "translateX":
      vars["--m-sc-tx"] = `${lerp(cfg.min ?? -intensity, cfg.max ?? intensity, p).toFixed(1)}px`;
      break;
    case "translateY":
      vars["--m-sc-ty"] = `${lerp(cfg.min ?? intensity, cfg.max ?? -intensity, p).toFixed(1)}px`;
      break;
    case "scale":
      vars["--m-sc-scale"] = lerp(cfg.min ?? 0.9, cfg.max ?? 1.08, p).toFixed(3);
      break;
    case "rotate":
      vars["--m-sc-rot"] = `${lerp(cfg.min ?? -12, cfg.max ?? 12, p).toFixed(2)}deg`;
      break;
    case "opacity":
      vars["--m-sc-op"] = lerp(cfg.min ?? 0.2, cfg.max ?? 1, p).toFixed(3);
      break;
    case "blur": {
      const b = Math.max(0, lerp(cfg.min ?? 8, cfg.max ?? 0, p));
      vars["--m-sc-filter"] = b > 0.05 ? `blur(${b.toFixed(2)}px)` : "none";
      break;
    }
    case "skew":
      vars["--m-sc-skew"] = `${lerp(cfg.min ?? -6, cfg.max ?? 6, p).toFixed(2)}deg`;
      break;
    case "parallaxVertical": {
      const delta = (cfg.speed ?? intensity) * (p - 0.5) * -2;
      vars["--m-sc-ty"] = `${delta.toFixed(1)}px`;
      break;
    }
    case "parallaxHorizontal": {
      const delta = (cfg.speed ?? intensity) * (p - 0.5) * 2;
      vars["--m-sc-tx"] = `${delta.toFixed(1)}px`;
      break;
    }
    case "parallaxBackground": {
      const pos = 50 + (p - 0.5) * Math.min(80, Math.abs(cfg.speed ?? intensity) * 1.4);
      vars["--m-sc-bg-y"] = `${pos.toFixed(1)}%`;
      break;
    }
    case "stickyScale":
      vars["--m-sc-scale"] = lerp(cfg.min ?? 1, cfg.max ?? 0.94, p).toFixed(3);
      break;
    case "stickyFade":
      vars["--m-sc-op"] = lerp(cfg.min ?? 1, cfg.max ?? 0.55, p).toFixed(3);
      break;
    case "stickyTransform":
      vars["--m-sc-ty"] = `${lerp(cfg.min ?? 0, cfg.max ?? -24, p).toFixed(1)}px`;
      break;
    default:
      break;
  }

  return vars;
}

export function applyScrollProgressToElement(
  el: HTMLElement,
  cfg: ScrollMotionConfig,
  progress01: number
): void {
  const vars = computeScrollVariables(cfg, progress01);
  const style = el.style;
  for (const key in vars) {
    style.setProperty(key, vars[key]);
  }
}

type Subscriber = {
  el: HTMLElement;
  cfg: ScrollMotionConfig;
  scroller: Window | HTMLElement;
};

const OVERFLOW_SCROLL_RE = /(auto|scroll)/;
const subscribers = new Set<Subscriber>();
const boundScrollers = new Map<Window | HTMLElement, number>();
let rafId: number | null = null;

function findScrollContainer(el: HTMLElement): Window | HTMLElement {
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    const style = window.getComputedStyle(cur);
    if (OVERFLOW_SCROLL_RE.test(style.overflowY) && cur.scrollHeight > cur.clientHeight + 4) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return window;
}

function flushScrollSubscribers(): void {
  rafId = null;
  if (subscribers.size === 0) return;

  const vh = window.innerHeight || 900;
  const containerRects = new Map<HTMLElement, { top: number; height: number }>();
  const pendingWrites: Array<{ sub: Subscriber; progress: number }> = [];

  // Phase 1: Batch all DOM layout reads before any style writes to prevent layout thrashing
  for (const sub of subscribers) {
    const rect = sub.el.getBoundingClientRect();
    const offset = sub.cfg.offset ?? 0;
    let containerTop = 0;
    let containerHeight = vh;
    if (sub.scroller !== window) {
      const scrollerEl = sub.scroller as HTMLElement;
      let cached = containerRects.get(scrollerEl);
      if (!cached) {
        const cRect = scrollerEl.getBoundingClientRect();
        cached = { top: cRect.top, height: cRect.height || vh };
        containerRects.set(scrollerEl, cached);
      }
      containerTop = cached.top;
      containerHeight = cached.height;
    }
    const totalTravel = containerHeight + rect.height;
    const raw =
      totalTravel > 0
        ? (containerTop + containerHeight - (rect.top + offset)) / totalTravel
        : 0.5;
    pendingWrites.push({ sub, progress: clamp01(raw) });
  }

  // Phase 2: Batch all DOM style writes
  for (let i = 0; i < pendingWrites.length; i++) {
    const item = pendingWrites[i];
    applyScrollProgressToElement(item.sub.el, item.sub.cfg, item.progress);
  }
}

function scheduleScrollFlush(): void {
  if (rafId !== null) return;
  rafId = window.requestAnimationFrame(flushScrollSubscribers);
}

/**
 * Registers an element with the shared passive rAF scroll engine (0 React re-renders).
 */
export function subscribeScrollMotion(
  el: HTMLElement,
  cfg: ScrollMotionConfig
): () => void {
  if (typeof window === "undefined") return () => {};
  const scroller = findScrollContainer(el);
  const sub: Subscriber = { el, cfg, scroller };
  subscribers.add(sub);

  const prevCount = boundScrollers.get(scroller) || 0;
  if (prevCount === 0) {
    scroller.addEventListener("scroll", scheduleScrollFlush, { passive: true });
    if (scroller === window) {
      window.addEventListener("resize", scheduleScrollFlush, { passive: true });
    }
  }
  boundScrollers.set(scroller, prevCount + 1);
  scheduleScrollFlush();

  return () => {
    subscribers.delete(sub);
    const left = (boundScrollers.get(scroller) || 1) - 1;
    if (left <= 0) {
      boundScrollers.delete(scroller);
      scroller.removeEventListener("scroll", scheduleScrollFlush);
      if (scroller === window) {
        window.removeEventListener("resize", scheduleScrollFlush);
      }
    } else {
      boundScrollers.set(scroller, left);
    }
    if (subscribers.size === 0 && rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
