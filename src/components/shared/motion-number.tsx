import type { ComponentProps } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants";
import { cn } from "@/lib/utils";

type MotionNumberProps = Omit<ComponentProps<"span">, "children"> & {
  value: number | string;
};

export function MotionNumber({ value, className, ...props }: MotionNumberProps) {
  return (
    <span
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={cn(MOTION_CONTENT_SWAP_CLASS_NAME, "tabular-nums", className)}
      {...props}
    >
      {value}
    </span>
  );
}
