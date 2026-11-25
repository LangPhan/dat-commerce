import type {
  AnimationPresetDefinition,
  ContinuousPresetKey,
  EntrancePresetKey,
  HoverPresetKey,
  InteractionPresetKey,
  MotionCategory,
  ScrollEffectKey,
  ScrollMode,
  TextAnimationPresetKey,
} from "./types";

function makeEntrance(
  key: EntrancePresetKey,
  name: string,
  group: string,
  description: string,
  defaultDuration = 550,
  defaultEasing = "easeOut"
): AnimationPresetDefinition {
  return {
    id: `sys-${key}`,
    presetKey: key,
    name,
    category: "entrance",
    group,
    description,
    defaultDuration,
    defaultEasing,
    isSystem: true,
    config: {
      enabled: true,
      entrance: {
        enabled: true,
        preset: key,
        trigger: "viewport",
        duration: defaultDuration,
        delay: 0,
        easing: defaultEasing,
        repeat: 1,
        repeatDelay: 0,
        direction: "normal",
        threshold: 0.15,
        once: true,
      },
    },
  };
}

function makeScroll(
  key: ScrollEffectKey,
  name: string,
  mode: ScrollMode,
  group: string,
  description: string,
  extra: Record<string, unknown> = {}
): AnimationPresetDefinition {
  return {
    id: `sys-scroll-${key}`,
    presetKey: `scroll-${key}`,
    name,
    category: "scroll",
    group,
    description,
    defaultDuration: 500,
    defaultEasing: "easeOut",
    isSystem: true,
    config: {
      enabled: true,
      scroll: {
        enabled: true,
        mode,
        effect: key,
        start: 0,
        end: 100,
        direction: "normal",
        intensity: 30,
        speed: 30,
        offset: 0,
        ...extra,
      },
    },
  };
}

function makeHover(
  key: HoverPresetKey,
  name: string,
  description: string,
  extra: Record<string, unknown> = {},
  defaultDuration = 220
): AnimationPresetDefinition {
  return {
    id: `sys-hover-${key}`,
    presetKey: `hover-${key}`,
    name,
    category: "hover",
    group: "Pointer Hover",
    description,
    defaultDuration,
    defaultEasing: "easeOut",
    isSystem: true,
    config: {
      enabled: true,
      hover: {
        enabled: true,
        preset: key,
        duration: defaultDuration,
        delay: 0,
        easing: "easeOut",
        ...extra,
      },
    },
  };
}

function makeInteraction(
  key: InteractionPresetKey,
  name: string,
  description: string,
  extra: Record<string, unknown> = {}
): AnimationPresetDefinition {
  return {
    id: `sys-int-${key}`,
    presetKey: `interaction-${key}`,
    name,
    category: "interaction",
    group: "Click & Focus",
    description,
    defaultDuration: 180,
    defaultEasing: "easeOut",
    isSystem: true,
    config: {
      enabled: true,
      interaction: {
        enabled: true,
        preset: key,
        triggers: ["click", "tap", "active"],
        duration: 180,
        easing: "easeOut",
        ...extra,
      },
    },
  };
}

function makeContinuous(
  key: ContinuousPresetKey,
  name: string,
  description: string,
  defaultDuration = 2400
): AnimationPresetDefinition {
  return {
    id: `sys-cont-${key}`,
    presetKey: `continuous-${key}`,
    name,
    category: "continuous",
    group: "Ambient Loop",
    description,
    defaultDuration,
    defaultEasing: "easeInOut",
    isSystem: true,
    config: {
      enabled: true,
      continuous: {
        enabled: true,
        preset: key,
        duration: defaultDuration,
        delay: 0,
        infinite: true,
        direction: "normal",
        easing: "easeInOut",
        pauseOnHover: true,
      },
    },
  };
}

function makeText(
  key: TextAnimationPresetKey,
  name: string,
  group: string,
  description: string,
  extra: Record<string, unknown> = {},
  defaultDuration = 550
): AnimationPresetDefinition {
  return {
    id: `sys-text-${key}`,
    presetKey: `text-${key}`,
    name,
    category: "text",
    group,
    description,
    defaultDuration,
    defaultEasing: "easeOut",
    isSystem: true,
    config: {
      enabled: true,
      text: {
        enabled: true,
        preset: key,
        duration: defaultDuration,
        delay: 0,
        easing: "easeOut",
        trigger: "viewport",
        ...extra,
      },
    },
  };
}

export const SYSTEM_ANIMATION_PRESETS: AnimationPresetDefinition[] = [
  // ---- ENTRANCE: FADE (5) ----
  makeEntrance("fadeIn", "Fade In", "Fade", "Smoothly fades opacity from 0 to 100%.", 500),
  makeEntrance("fadeInUp", "Fade In Up", "Fade", "Rises subtly from below while fading in.", 600),
  makeEntrance("fadeInDown", "Fade In Down", "Fade", "Drops gently from above while fading in.", 600),
  makeEntrance("fadeInLeft", "Fade In Left", "Fade", "Glides in from the left edge with fade.", 600),
  makeEntrance("fadeInRight", "Fade In Right", "Fade", "Glides in from the right edge with fade.", 600),

  // ---- ENTRANCE: SLIDE (4) ----
  makeEntrance("slideInUp", "Slide In Up", "Slide", "Crisp upward slide into position.", 550),
  makeEntrance("slideInDown", "Slide In Down", "Slide", "Crisp downward slide into position.", 550),
  makeEntrance("slideInLeft", "Slide In Left", "Slide", "Horizontal slide from the left.", 550),
  makeEntrance("slideInRight", "Slide In Right", "Slide", "Horizontal slide from the right.", 550),

  // ---- ENTRANCE: ZOOM (5) ----
  makeEntrance("zoomIn", "Zoom In", "Zoom", "Scales gently up from 90% with fade.", 520),
  makeEntrance("zoomInUp", "Zoom In Up", "Zoom", "Scales up while rising into focus.", 580),
  makeEntrance("zoomInDown", "Zoom In Down", "Zoom", "Scales up while descending into view.", 580),
  makeEntrance("zoomInLeft", "Zoom In Left", "Zoom", "Scales up from the left side.", 580),
  makeEntrance("zoomInRight", "Zoom In Right", "Zoom", "Scales up from the right side.", 580),

  // ---- ENTRANCE: BOUNCE (3) ----
  makeEntrance("bounceIn", "Bounce In", "Bounce", "Playful spring pop-in entrance.", 700, "spring"),
  makeEntrance("bounceInUp", "Bounce In Up", "Bounce", "Bouncy upward settle for badges & CTAs.", 720, "spring"),
  makeEntrance("bounceInDown", "Bounce In Down", "Bounce", "Bouncy drop from above.", 720, "spring"),

  // ---- ENTRANCE: ROTATE (3) ----
  makeEntrance("rotateIn", "Rotate In", "Rotate", "Subtle rotational swing into place.", 600),
  makeEntrance("rotateInUp", "Rotate In Up", "Rotate", "Tilts upward into clean horizontal alignment.", 640),
  makeEntrance("rotateInDown", "Rotate In Down", "Rotate", "Tilts downward into alignment.", 640),

  // ---- ENTRANCE: SPECIAL (5) ----
  makeEntrance("flipInX", "Flip In X", "Special", "3D horizontal axis flip reveal.", 680),
  makeEntrance("flipInY", "Flip In Y", "Special", "3D vertical card flip reveal.", 680),
  makeEntrance("backInUp", "Back In Up", "Special", "Elastic overshoot entrance from below.", 680, "spring"),
  makeEntrance("backInDown", "Back In Down", "Special", "Elastic overshoot entrance from above.", 680, "spring"),
  makeEntrance("lightSpeedIn", "Light Speed In", "Special", "Fast skewed deceleration sweep.", 560),

  // ---- SCROLL: REVEAL (7) ----
  makeScroll("scrollFade", "Fade on Scroll", "reveal", "Scroll Reveal", "Fades in smoothly as scroll passes element."),
  makeScroll("scrollSlide", "Slide on Scroll", "reveal", "Scroll Reveal", "Slides upward dynamically with scroll progress."),
  makeScroll("scrollZoom", "Zoom on Scroll", "reveal", "Scroll Reveal", "Scales smoothly into place as you scroll."),
  makeScroll("revealTop", "Reveal from Top", "reveal", "Scroll Reveal", "Unveils downward from the top edge."),
  makeScroll("revealBottom", "Reveal from Bottom", "reveal", "Scroll Reveal", "Unveils upward from the bottom edge."),
  makeScroll("revealLeft", "Reveal from Left", "reveal", "Scroll Reveal", "Wipes smoothly from left to right."),
  makeScroll("revealRight", "Reveal from Right", "reveal", "Scroll Reveal", "Wipes smoothly from right to left."),

  // ---- SCROLL: LINKED (7) ----
  makeScroll("translateX", "Translate X", "linked", "Scroll-Linked", "Scrubs horizontal position with scroll.", { min: -40, max: 40 }),
  makeScroll("translateY", "Translate Y", "linked", "Scroll-Linked", "Scrubs vertical position with scroll.", { min: 40, max: -40 }),
  makeScroll("scale", "Scroll Scale", "linked", "Scroll-Linked", "Scales smoothly between min and max on scroll.", { min: 0.9, max: 1.08 }),
  makeScroll("rotate", "Scroll Rotate", "linked", "Scroll-Linked", "Rotates gradually as the viewport moves.", { min: -12, max: 12 }),
  makeScroll("opacity", "Scroll Opacity", "linked", "Scroll-Linked", "Interpolates opacity along scroll progress.", { min: 0.2, max: 1 }),
  makeScroll("blur", "Scroll Blur", "linked", "Scroll-Linked", "Brings element from soft blur into sharp focus.", { min: 8, max: 0 }),
  makeScroll("skew", "Scroll Skew", "linked", "Scroll-Linked", "Applies subtle editorial skew during scroll.", { min: -6, max: 6 }),

  // ---- SCROLL: PARALLAX (3) ----
  makeScroll("parallaxVertical", "Vertical Parallax", "parallax", "Parallax", "Depth-layered vertical scroll offset.", { speed: 30, intensity: 30 }),
  makeScroll("parallaxHorizontal", "Horizontal Parallax", "parallax", "Parallax", "Lateral parallax drift while scrolling.", { speed: 24, intensity: 24 }),
  makeScroll("parallaxBackground", "Background Parallax", "parallax", "Parallax", "Shifts background image position on scroll.", { speed: 35, intensity: 35 }),

  // ---- SCROLL: STICKY (3) ----
  makeScroll("stickyScale", "Sticky Scale", "sticky", "Sticky Effects", "Pins element while gently scaling.", { stickyOffset: 24, stickyDuration: 600, min: 1, max: 0.94 }),
  makeScroll("stickyFade", "Sticky Fade", "sticky", "Sticky Effects", "Pins element and softly fades through scroll.", { stickyOffset: 24, stickyDuration: 600, min: 1, max: 0.55 }),
  makeScroll("stickyTransform", "Sticky Transform", "sticky", "Sticky Effects", "Pins element with subtle vertical glide.", { stickyOffset: 24, stickyDuration: 600, min: 0, max: -24 }),

  // ---- HOVER (14) ----
  makeHover("scaleUp", "Scale Up", "Elevates element with gentle zoom.", { scale: 1.03 }),
  makeHover("scaleDown", "Scale Down", "Subtle inward scale on pointer hover.", { scale: 0.97 }),
  makeHover("moveUp", "Move Up", "Lifts card upward cleanly on hover.", { translateY: -6 }),
  makeHover("moveDown", "Move Down", "Settles element downward on hover.", { translateY: 6 }),
  makeHover("moveLeft", "Move Left", "Nudges element left on hover.", { translateX: -6 }),
  makeHover("moveRight", "Move Right", "Nudges element right on hover.", { translateX: 6 }),
  makeHover("rotate", "Rotate", "Subtle playful angle tilt on hover.", { rotate: 3 }),
  makeHover("tilt", "3D Tilt", "Editorial perspective tilt on hover.", { rotate: -2, scale: 1.02 }),
  makeHover("fade", "Fade", "Softens opacity cleanly on hover.", { opacity: 0.82 }),
  makeHover("shadow", "Elevated Shadow", "Deepens drop shadow on hover.", { translateY: -3, shadow: "0 16px 36px rgba(15, 23, 42, 0.16)" }),
  makeHover("glow", "Brand Glow", "Soft luminous brand ring glow on hover.", { shadow: "0 0 0 4px rgba(91, 70, 232, 0.22)" }),
  makeHover("blur", "Soft Blur", "Gentle focus blur transition on hover.", { blur: 2 }),
  makeHover("borderHighlight", "Border Highlight", "Highlights border accent smoothly on hover."),
  makeHover("underlineReveal", "Underline Reveal", "Sweeps crisp underline across links on hover."),

  // ---- INTERACTION (6) ----
  makeInteraction("buttonPress", "Button Press", "Tactile 96% press response on click/tap.", { scale: 0.96, duration: 130 }),
  makeInteraction("clickScaleDown", "Scale Down on Click", "Compact squeeze response on active press.", { scale: 0.93, duration: 150 }),
  makeInteraction("iconRotate", "Icon Rotation", "Smooth rotational feedback on tap or toggle.", { rotate: 180, duration: 240 }),
  makeInteraction("accordionExpand", "Accordion Expand", "Fluid expand/collapse height feel on toggle.", { duration: 260 }),
  makeInteraction("toggleTransition", "Toggle Transition", "Snappy state transition for interactive controls.", { scale: 0.98, duration: 180 }),
  makeInteraction("modalEntrance", "Modal Pop Entrance", "Crisp spring focus entrance for panels & dialogs.", { scale: 1.02, duration: 240 }),

  // ---- CONTINUOUS (10) ----
  makeContinuous("floating", "Floating", "Weightless vertical float loop.", 3000),
  makeContinuous("pulse", "Pulse", "Gentle scale & opacity heartbeat.", 2200),
  makeContinuous("bounce", "Bounce", "Rhythmic vertical bounce cue.", 1600),
  makeContinuous("swing", "Swing", "Pendulum tilt oscillation.", 2400),
  makeContinuous("shake", "Shake", "Attention-grabbing micro horizontal shake.", 1400),
  makeContinuous("rotate", "Rotate", "Continuous smooth 360-degree spin.", 6000),
  makeContinuous("wobble", "Wobble", "Playful elastic wobble loop.", 2200),
  makeContinuous("breathing", "Breathing", "Calm slow scale expansion for hero imagery.", 4000),
  makeContinuous("shimmer", "Shimmer", "Subtle light-sweep highlight shimmer.", 2600),
  makeContinuous("wave", "Wave", "Organic undulating wave cadence.", 2800),

  // ---- TEXT (10) ----
  makeText("textFadeIn", "Fade In Text", "Entrance", "Clean opacity reveal for headlines and copy.", {}, 550),
  makeText("textSlideUp", "Slide Up", "Entrance", "Editorial masked rise from baseline.", {}, 600),
  makeText("textSlideDown", "Slide Down", "Entrance", "Masked reveal descending from top.", {}, 600),
  makeText("textBlurReveal", "Blur Reveal", "Entrance", "Sharpens headline from soft Gaussian blur.", {}, 680),
  makeText("staggerChar", "Character by Character", "Staggered", "Reveals each character in sequence.", { splitBy: "char", staggerMs: 28 }, 420),
  makeText("staggerWord", "Word by Word", "Staggered", "Staggers headline words cleanly into place.", { splitBy: "word", staggerMs: 75 }, 480),
  makeText("staggerLine", "Line by Line", "Staggered", "Reveals multi-line copy line by line.", { splitBy: "line", staggerMs: 120 }, 520),
  makeText("typingEffect", "Typing Effect", "Decorative", "Progressive typewriter reveal with caret.", { splitBy: "char", staggerMs: 42 }, 400),
  makeText("textReveal", "Text Clip Reveal", "Decorative", "Horizontal curtain sweep unveiling text.", {}, 700),
  makeText("gradientTextMove", "Gradient Text Movement", "Decorative", "Flowing animated gradient fill across text.", {}, 3600),
];

export function getPresetsByCategory(
  category: MotionCategory | "all",
  customPresets: AnimationPresetDefinition[] = []
): AnimationPresetDefinition[] {
  const combined = [...SYSTEM_ANIMATION_PRESETS, ...customPresets];
  if (category === "all") return combined;
  return combined.filter((p) => p.category === category);
}

export function findPresetByKey(
  key: string | undefined,
  customPresets: AnimationPresetDefinition[] = []
): AnimationPresetDefinition | null {
  if (!key) return null;
  const custom = customPresets.find((p) => p.presetKey === key || p.id === key);
  if (custom) return custom;
  return SYSTEM_ANIMATION_PRESETS.find((p) => p.presetKey === key || p.id === key) || null;
}

export function dtoToPresetDefinition(dto: {
  id: string;
  presetKey: string;
  name: string;
  category: string;
  description?: string | null;
  config: Record<string, unknown>;
  isSystem: boolean;
  isFavorite?: boolean;
  version?: number;
}): AnimationPresetDefinition {
  const cfg = (dto.config || {}) as AnimationPresetDefinition["config"];
  const dur =
    cfg.entrance?.duration ??
    cfg.hover?.duration ??
    cfg.continuous?.duration ??
    cfg.text?.duration ??
    cfg.interaction?.duration ??
    500;
  const ease =
    cfg.entrance?.easing ??
    cfg.hover?.easing ??
    cfg.continuous?.easing ??
    "easeOut";
  return {
    id: dto.id,
    presetKey: dto.presetKey,
    name: dto.name,
    category: (dto.category as MotionCategory) || "custom",
    group: dto.isSystem ? "System" : "Custom Presets",
    description: dto.description || "",
    defaultDuration: dur,
    defaultEasing: ease,
    config: cfg,
    isSystem: dto.isSystem,
    isFavorite: Boolean(dto.isFavorite),
    version: dto.version,
  };
}
