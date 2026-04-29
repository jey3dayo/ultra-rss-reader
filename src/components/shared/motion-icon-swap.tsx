import type { ReactNode } from "react";
import {
  MOTION_DATA_ICON_ATTRIBUTE,
  MOTION_DATA_STATE_ATTRIBUTE,
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
    <span
      className={cn(MOTION_ICON_SWAP_CLASS_NAME, className)}
      {...{ [MOTION_DATA_STATE_ATTRIBUTE]: state }}
      aria-hidden="true"
    >
      <span className={MOTION_ICON_SWAP_ICON_CLASS_NAME} {...{ [MOTION_DATA_ICON_ATTRIBUTE]: MOTION_ICON_SWAP_ICON_A }}>
        {iconA}
      </span>
      <span className={MOTION_ICON_SWAP_ICON_CLASS_NAME} {...{ [MOTION_DATA_ICON_ATTRIBUTE]: MOTION_ICON_SWAP_ICON_B }}>
        {iconB}
      </span>
    </span>
  );
}
