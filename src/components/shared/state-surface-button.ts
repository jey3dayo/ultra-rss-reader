import { type StateTone, stateToneSurfaceClassNames } from "@/components/shared/state-tone";

// Button-specific layer on top of the shared state-tone triplet: flat surface,
// hover step via the paired --state-*-surface-hover token, pinned focus border.
const stateSurfaceButtonInteractionClassNames = {
  warning:
    "shadow-none hover:border-state-warning-border hover:bg-state-warning-surface-hover hover:text-state-warning-foreground focus-visible:border-state-warning-border",
  danger:
    "shadow-none hover:border-state-danger-border hover:bg-state-danger-surface-hover hover:text-state-danger-foreground focus-visible:border-state-danger-border",
  success:
    "shadow-none hover:border-state-success-border hover:bg-state-success-surface-hover hover:text-state-success-foreground focus-visible:border-state-success-border",
} as const satisfies Record<StateTone, string>;

export type StateSurfaceButtonTone = StateTone;

export function stateSurfaceButtonClassName(tone: StateSurfaceButtonTone): string {
  return `${stateToneSurfaceClassNames[tone]} ${stateSurfaceButtonInteractionClassNames[tone]}`;
}
