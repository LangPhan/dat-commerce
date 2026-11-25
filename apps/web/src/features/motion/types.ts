import type { ViewportMode } from "@/features/builder/types";

export type MotionCategory =
  | "entrance"
  | "scroll"
  | "hover"
  | "interaction"
  | "continuous"
  | "text"
  | "custom";

export type EntrancePresetKey =
  | "none"
  | "fadeIn"
  | "fadeInUp"
  | "fadeInDown"
  | "fadeInLeft"
  | "fadeInRight"
  | "slideInUp"
  | "slideInDown"
  | "slideInLeft"
  | "slideInRight"
  | "zoomIn"
  | "zoomInUp"
  | "zoomInDown"
  | "zoomInLeft"
  | "zoomInRight"
  | "bounceIn"
  | "bounceInUp"
  | "bounceInDown"
  | "rotateIn"
  | "rotateInUp"
  | "rotateInDown"
  | "flipInX"
  | "flipInY"
  | "backInUp"
  | "backInDown"
  | "lightSpeedIn";

export type ScrollMode = "reveal" | "linked" | "parallax" | "sticky";

export type ScrollEffectKey =
  | "none"
  | "scrollFade"
  | "scrollSlide"
  | "scrollZoom"
  | "revealTop"
  | "revealBottom"
  | "revealLeft"
  | "revealRight"
  | "translateX"
  | "translateY"
  | "scale"
  | "rotate"
  | "opacity"
  | "blur"
  | "skew"
  | "parallaxVertical"
  | "parallaxHorizontal"
  | "parallaxBackground"
  | "stickyScale"
  | "stickyFade"
  | "stickyTransform";

export type HoverPresetKey =
  | "none"
  | "scaleUp"
  | "scaleDown"
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "rotate"
  | "tilt"
  | "fade"
  | "shadow"
  | "glow"
  | "blur"
  | "borderHighlight"
  | "underlineReveal";

export type InteractionPresetKey =
  | "none"
  | "buttonPress"
  | "clickScaleDown"
  | "iconRotate"
  | "accordionExpand"
  | "toggleTransition"
  | "modalEntrance";

export type InteractionTrigger = "click" | "tap" | "focus" | "active" | "toggle";

export type ContinuousPresetKey =
  | "none"
  | "floating"
  | "pulse"
  | "bounce"
  | "swing"
  | "shake"
  | "rotate"
  | "wobble"
  | "breathing"
  | "shimmer"
  | "wave";

export type TextAnimationPresetKey =
  | "none"
  | "textFadeIn"
  | "textSlideUp"
  | "textSlideDown"
  | "textBlurReveal"
  | "staggerChar"
  | "staggerWord"
  | "staggerLine"
  | "typingEffect"
  | "textReveal"
  | "gradientTextMove";

export type MotionDirection =
  | "normal"
  | "reverse"
  | "alternate"
  | "alternate-reverse";

export type MotionEasingToken =
  | "linear"
  | "ease"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "spring"
  | "custom"
  | string;

export type EntranceMotionConfig = {
  enabled?: boolean;
  preset?: EntrancePresetKey;
  trigger?: "load" | "viewport";
  duration?: number;
  delay?: number;
  easing?: MotionEasingToken;
  repeat?: number;
  repeatDelay?: number;
  direction?: MotionDirection;
  threshold?: number;
  distance?: number;
  once?: boolean;
};

export type ScrollMotionConfig = {
  enabled?: boolean;
  mode?: ScrollMode;
  effect?: ScrollEffectKey;
  start?: number;
  end?: number;
  direction?: "normal" | "reverse" | "up" | "down" | "left" | "right";
  min?: number;
  max?: number;
  speed?: number;
  intensity?: number;
  offset?: number;
  stickyOffset?: number;
  stickyDuration?: number;
  duration?: number;
  easing?: MotionEasingToken;
};

export type HoverMotionConfig = {
  enabled?: boolean;
  preset?: HoverPresetKey;
  scale?: number;
  translateX?: number;
  translateY?: number;
  rotate?: number;
  opacity?: number;
  blur?: number;
  shadow?: string;
  duration?: number;
  delay?: number;
  easing?: MotionEasingToken;
};

export type InteractionMotionConfig = {
  enabled?: boolean;
  preset?: InteractionPresetKey;
  trigger?: InteractionTrigger;
  triggers?: InteractionTrigger[];
  scale?: number;
  rotate?: number;
  duration?: number;
  easing?: MotionEasingToken;
};

export type ContinuousMotionConfig = {
  enabled?: boolean;
  preset?: ContinuousPresetKey;
  duration?: number;
  delay?: number;
  repeat?: number;
  infinite?: boolean;
  direction?: MotionDirection;
  easing?: MotionEasingToken;
  pauseOnHover?: boolean;
};

export type TextMotionConfig = {
  enabled?: boolean;
  preset?: TextAnimationPresetKey;
  splitBy?: "char" | "word" | "line";
  staggerMs?: number;
  duration?: number;
  delay?: number;
  easing?: MotionEasingToken;
  trigger?: "load" | "viewport";
};

export type StaggerMotionConfig = {
  enabled?: boolean;
  preset?: EntrancePresetKey;
  initialDelay?: number;
  interval?: number;
  maxDelay?: number;
  duration?: number;
  direction?: "forward" | "reverse" | "center";
  order?: "sequential" | "row" | "column";
  trigger?: "load" | "viewport";
};

export type ResponsiveMotionOverride = {
  enabled?: boolean;
  presetRef?: string;
  entrance?: EntranceMotionConfig;
  scroll?: ScrollMotionConfig;
  hover?: HoverMotionConfig;
  interaction?: InteractionMotionConfig;
  continuous?: ContinuousMotionConfig;
  text?: TextMotionConfig;
  stagger?: StaggerMotionConfig;
};

export type ElementMotionConfig = {
  schemaVersion?: number;
  enabled?: boolean;
  presetRef?: string;
  entrance?: EntranceMotionConfig;
  scroll?: ScrollMotionConfig;
  hover?: HoverMotionConfig;
  interaction?: InteractionMotionConfig;
  continuous?: ContinuousMotionConfig;
  text?: TextMotionConfig;
  stagger?: StaggerMotionConfig;
  responsive?: {
    tablet?: ResponsiveMotionOverride;
    mobile?: ResponsiveMotionOverride;
  };
};

export type MotionTimingTokens = {
  fast: number;
  normal: number;
  slow: number;
};

export type MotionEasingTokens = {
  linear: string;
  ease: string;
  easeIn: string;
  easeOut: string;
  easeInOut: string;
  custom: string;
};

export type GlobalMotionSettings = {
  schemaVersion?: number;
  enabled?: boolean;
  scrollEffectsEnabled?: boolean;
  hoverEffectsEnabled?: boolean;
  mobileBehavior?: "full" | "reduced" | "disabled";
  reducedMotionPolicy?: "respect-system" | "always-reduced" | "essential-only";
  defaultDuration?: number;
  defaultEasing?: MotionEasingToken;
  defaultHoverDuration?: number;
  defaultEntrancePreset?: EntrancePresetKey | string;
  timingTokens?: Partial<MotionTimingTokens>;
  easingTokens?: Partial<MotionEasingTokens>;
};

export type NormalizedGlobalMotion = {
  schemaVersion: number;
  enabled: boolean;
  scrollEffectsEnabled: boolean;
  hoverEffectsEnabled: boolean;
  mobileBehavior: "full" | "reduced" | "disabled";
  reducedMotionPolicy: "respect-system" | "always-reduced" | "essential-only";
  defaultDuration: number;
  defaultEasing: string;
  defaultHoverDuration: number;
  defaultEntrancePreset: EntrancePresetKey | string;
  timingTokens: MotionTimingTokens;
  easingTokens: MotionEasingTokens;
};

export type AnimationPresetDefinition = {
  id: string;
  presetKey: string;
  name: string;
  category: MotionCategory;
  group?: string;
  description: string;
  defaultDuration: number;
  defaultEasing: string;
  config: ElementMotionConfig;
  isSystem: boolean;
  isFavorite?: boolean;
  version?: number;
};

export type ResolvedViewportMotion = {
  viewport: ViewportMode;
  enabled: boolean;
  disabledByBreakpoint: boolean;
  disabledByGlobal: boolean;
  isInherited: boolean;
  hasCustomOverride: boolean;
  presetRef?: string;
  entrance?: EntranceMotionConfig;
  scroll?: ScrollMotionConfig;
  hover?: HoverMotionConfig;
  interaction?: InteractionMotionConfig;
  continuous?: ContinuousMotionConfig;
  text?: TextMotionConfig;
  stagger?: StaggerMotionConfig;
};

export type MotionAiOperation =
  | {
      type: "set_element_animation";
      nodeId?: string;
      targetId?: string;
      animation: ElementMotionConfig | Record<string, unknown>;
    }
  | {
      type: "update_element_animation";
      nodeId?: string;
      targetId?: string;
      patch: Partial<ElementMotionConfig> | Record<string, unknown>;
    }
  | {
      type: "remove_element_animation";
      nodeId?: string;
      targetId?: string;
      category?: MotionCategory | "all";
    }
  | {
      type: "apply_animation_to_selection";
      nodeIds?: string[];
      targetIds?: string[];
      animation: ElementMotionConfig | Record<string, unknown>;
    }
  | {
      type: "update_responsive_animation";
      nodeId?: string;
      targetId?: string;
      breakpoint: "tablet" | "mobile";
      override: ResponsiveMotionOverride;
    }
  | {
      type: "update_global_motion";
      patch: Partial<GlobalMotionSettings>;
    }
  | {
      type: "create_animation_preset";
      name: string;
      category: MotionCategory;
      description?: string;
      config: ElementMotionConfig;
    };
