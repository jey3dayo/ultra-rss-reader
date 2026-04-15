import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DecisionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  intent: "keep" | "defer" | "delete";
};

const decisionIntentClassName = {
  keep: "border border-emerald-500/25 bg-emerald-500/12 text-emerald-900 hover:bg-emerald-500/18 dark:text-emerald-100",
  defer: "border border-border bg-surface-2 text-foreground hover:bg-surface-3",
  delete: "border border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/18",
} as const;

export function DecisionButton({ intent, className, type = "button", ...props }: DecisionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-elevation-1 transition-[color,background-color,border-color,box-shadow]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        "disabled:pointer-events-none disabled:opacity-50",
        decisionIntentClassName[intent],
        className,
      )}
      {...props}
    />
  );
}
