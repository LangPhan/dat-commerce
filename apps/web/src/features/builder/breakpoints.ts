export const BREAKPOINTS = {
  tabletMax: 1024,
  mobileMax: 767,
  desktopMin: 1025,
} as const;

export const MEDIA_QUERIES = {
  desktop: `(min-width: ${BREAKPOINTS.desktopMin}px)`,
  tablet: `(max-width: ${BREAKPOINTS.tabletMax}px)`,
  mobile: `(max-width: ${BREAKPOINTS.mobileMax}px)`,
} as const;
