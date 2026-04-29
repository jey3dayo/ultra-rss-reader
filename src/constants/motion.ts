export const MOTION_INTERACTIVE_SURFACE_CLASS_NAME = "motion-interactive-surface";
export const MOTION_BUTTON_SURFACE_CLASS_NAME = "motion-button-surface";
export const MOTION_DISCLOSURE_PANEL_CLASS_NAME = "motion-disclosure-panel";
export const MOTION_DISCLOSURE_TRIGGER_CLASS_NAME = "motion-disclosure-trigger";
export const MOTION_CONTENT_SWAP_CLASS_NAME = "motion-content-swap";
export const MOTION_CONTEXTUAL_SURFACE_CLASS_NAME = "motion-contextual-surface";
export const MOTION_STATIC_HOVER_SURFACE_CLASS_NAME = "motion-static-hover-surface";
export const MOTION_RESIZE_SURFACE_CLASS_NAME = "motion-resize-surface";
export const MOTION_POPUP_SURFACE_CLASS_NAME = "motion-popup-surface";
export const MOTION_POPUP_OVERLAY_CLASS_NAME = "motion-popup-overlay";
export const MOTION_POPUP_DIALOG_CLASS_NAME = "motion-popup-dialog";
export type MotionClassName =
  | typeof MOTION_INTERACTIVE_SURFACE_CLASS_NAME
  | typeof MOTION_BUTTON_SURFACE_CLASS_NAME
  | typeof MOTION_DISCLOSURE_PANEL_CLASS_NAME
  | typeof MOTION_DISCLOSURE_TRIGGER_CLASS_NAME
  | typeof MOTION_CONTENT_SWAP_CLASS_NAME
  | typeof MOTION_CONTEXTUAL_SURFACE_CLASS_NAME
  | typeof MOTION_STATIC_HOVER_SURFACE_CLASS_NAME
  | typeof MOTION_RESIZE_SURFACE_CLASS_NAME
  | typeof MOTION_POPUP_SURFACE_CLASS_NAME
  | typeof MOTION_POPUP_OVERLAY_CLASS_NAME
  | typeof MOTION_POPUP_DIALOG_CLASS_NAME;

export const MOTION_CONTENT_SWAP_ENTER_KEYFRAMES_NAME = "motion-content-swap-enter";
export type MotionKeyframesName = typeof MOTION_CONTENT_SWAP_ENTER_KEYFRAMES_NAME;

export const MOTION_DATA_PHASE_ATTRIBUTE = "data-motion-phase";
export const MOTION_DATA_STATE_ATTRIBUTE = "data-state";
export const MOTION_DATA_ICON_ATTRIBUTE = "data-icon";
export const MOTION_DATA_SIDE_ATTRIBUTE = "data-side";
export const MOTION_DATA_STARTING_STYLE_ATTRIBUTE = "data-starting-style";
export type MotionDataAttribute =
  | typeof MOTION_DATA_PHASE_ATTRIBUTE
  | typeof MOTION_DATA_STATE_ATTRIBUTE
  | typeof MOTION_DATA_ICON_ATTRIBUTE
  | typeof MOTION_DATA_SIDE_ATTRIBUTE
  | typeof MOTION_DATA_STARTING_STYLE_ATTRIBUTE;

export const MOTION_POPUP_SIDE_TOP = "top";
export type MotionPopupSide = typeof MOTION_POPUP_SIDE_TOP;

export const MOTION_PHASE_STEADY = "steady";
export const MOTION_PHASE_ENTERING = "entering";
export type MotionPhase = typeof MOTION_PHASE_STEADY | typeof MOTION_PHASE_ENTERING;

export const MOTION_STATE_OPEN = "open";
export const MOTION_STATE_CLOSED = "closed";
export type MotionDisclosureState = typeof MOTION_STATE_OPEN | typeof MOTION_STATE_CLOSED;

export const MOTION_ICON_SWAP_CLASS_NAME = "motion-icon-swap";
export const MOTION_ICON_SWAP_ICON_CLASS_NAME = "motion-icon-swap-icon";

export const MOTION_ICON_SWAP_STATE_A = "a";
export const MOTION_ICON_SWAP_STATE_B = "b";
export type MotionIconSwapState = typeof MOTION_ICON_SWAP_STATE_A | typeof MOTION_ICON_SWAP_STATE_B;

export const MOTION_ICON_SWAP_ICON_A = "a";
export const MOTION_ICON_SWAP_ICON_B = "b";
export type MotionIconSwapIcon = typeof MOTION_ICON_SWAP_ICON_A | typeof MOTION_ICON_SWAP_ICON_B;
