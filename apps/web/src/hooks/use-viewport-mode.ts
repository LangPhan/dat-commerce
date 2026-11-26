"use client";

import { MEDIA_QUERIES } from "@/features/builder/breakpoints";
import type { ViewportMode } from "@/features/builder/types";
import { useMediaQuery } from "./use-media-query";

export function useViewportMode(enabled = true): ViewportMode {
  const isMobile = useMediaQuery(MEDIA_QUERIES.mobile, false);
  const isTablet = useMediaQuery(MEDIA_QUERIES.tablet, false);

  if (!enabled) return "desktop";
  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}
