import type { ReactNode } from "react";
import {
  MOTION_ICON_SWAP_CLASS_NAME,
  MOTION_ICON_SWAP_ICON_A,
  MOTION_ICON_SWAP_ICON_B,
  MOTION_ICON_SWAP_ICON_CLASS_NAME,
  type MotionIconSwapState,
} from "@/constants";
import { cn } from "@/lib/utils";

type MotionIconSwapProps = {
  state: MotionIconSwapState;
  iconA: ReactNode;
  iconB: ReactNode;
  className?: string;
};

export function MotionIconSwap({ state, iconA, iconB, className }: MotionIconSwapProps) {
  return (
    <span className={cn(MOTION_ICON_SWAP_CLASS_NAME, className)} data-state={state} aria-hidden="true">
      <span className={MOTION_ICON_SWAP_ICON_CLASS_NAME} data-icon={MOTION_ICON_SWAP_ICON_A}>
        {iconA}
      </span>
      <span className={MOTION_ICON_SWAP_ICON_CLASS_NAME} data-icon={MOTION_ICON_SWAP_ICON_B}>
        {iconB}
      </span>
    </span>
  );
}
