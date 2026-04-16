import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DecisionButtonProps = ComponentProps<typeof Button> & {
  intent: "keep" | "defer" | "delete";
};

const decisionIntentClassName = {
  keep:
    "border-state-success-border bg-state-success-surface text-state-success-foreground shadow-none hover:border-state-success-border hover:bg-state-success-surface",
  defer:
    "border-border-strong bg-surface-1/88 text-foreground-soft shadow-none hover:bg-surface-2 hover:text-foreground",
  delete:
    "border-destructive/20 bg-destructive/8 text-destructive shadow-none hover:border-destructive/30 hover:bg-destructive/12",
} as const;

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
      className={cn("font-medium [&_svg]:size-3.5", decisionIntentClassName[intent], className)}
      {...props}
    />
  );
}
