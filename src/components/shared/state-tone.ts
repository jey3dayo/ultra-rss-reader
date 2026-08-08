// Single source for the bare semantic state-surface triplet shared by
// LabelChip, SurfaceCard, and the state-surface button recipe. Keep hue
// literals expanded per tone: Tailwind only picks up statically written
// class names, so `state-${tone}` interpolation would silently drop styles.
export const stateToneSurfaceClassNames = {
  warning: "border-state-warning-border bg-state-warning-surface text-state-warning-foreground",
  danger: "border-state-danger-border bg-state-danger-surface text-state-danger-foreground",
  success: "border-state-success-border bg-state-success-surface text-state-success-foreground",
} as const;

export type StateTone = keyof typeof stateToneSurfaceClassNames;
