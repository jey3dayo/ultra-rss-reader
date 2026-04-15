import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DecisionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  intent: "keep" | "defer" | "delete";
};

const decisionIntentClassName = {
  keep: "bg-emerald-600/90 text-emerald-50 hover:bg-emerald-500",
  defer: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
  delete: "bg-red-950/90 text-red-100 hover:bg-red-900",
} as const;

export function DecisionButton({ intent, className, type = "button", ...props }: DecisionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
        "disabled:pointer-events-none disabled:opacity-50",
        decisionIntentClassName[intent],
        className,
      )}
      {...props}
    />
  );
}
