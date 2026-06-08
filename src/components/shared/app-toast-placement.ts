export const APP_TOAST_PLACEMENTS = {
  bottomRight: "bottom-right",
  browserRail: "browser-rail",
} as const;

export type AppToastPlacement = (typeof APP_TOAST_PLACEMENTS)[keyof typeof APP_TOAST_PLACEMENTS];
