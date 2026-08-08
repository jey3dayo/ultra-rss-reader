import type { ComponentProps } from "react";
import { stateSurfaceButtonClassName } from "@/components/shared/state-surface-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DecisionButtonProps = ComponentProps<typeof Button> & {
  intent: "keep" | "defer" | "delete";
};

const decisionIntentClassName: Record<DecisionButtonProps["intent"], string> = {
  keep: stateSurfaceButtonClassName("success"),
  defer:
    "border-border-strong bg-surface-1/88 text-foreground-soft shadow-none hover:bg-surface-2 hover:text-foreground",
  delete: stateSurfaceButtonClassName("danger"),
};

export const workspaceCompactActionButtonClassName =
  "min-h-11 justify-center rounded-md px-3 font-medium sm:px-3.5 [&_svg]:size-3.5";

export const denseDecisionButtonClassName = "min-w-[7.5rem] sm:min-w-[8.5rem]";

export function DecisionButton({
  intent,
  className,
  type = "button",
  size = "sm",
  variant = "outline",
  ...props
}: DecisionButtonProps) {
  return (
    <Button
      type={type}
      size={size}
      variant={variant}
      className={cn(workspaceCompactActionButtonClassName, decisionIntentClassName[intent], className)}
      {...props}
    />
  );
}
