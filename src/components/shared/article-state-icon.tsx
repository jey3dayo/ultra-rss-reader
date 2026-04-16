import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StarIconProps, UnreadIconProps } from "./article-state-icon.types";

export function UnreadIcon({ unread, forceTone = false, tone = "state", className }: UnreadIconProps) {
  const showSemanticTone = tone === "state" && (unread || forceTone);

  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full",
        showSemanticTone && "text-[var(--tone-unread)] border-[color-mix(in_srgb,var(--tone-unread)_88%,transparent)]",
        unread
          ? showSemanticTone
            ? "bg-[var(--tone-unread)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--tone-unread)_45%,transparent)]"
            : "border-2 border-current/85"
          : forceTone
            ? tone === "state"
              ? "border-2"
              : "border-2 border-current/85"
            : "border-2 border-current/85",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function StarIcon({ starred, forceTone = false, tone = "state", className, ...props }: StarIconProps) {
  const showSemanticTone = tone === "state" && (starred || forceTone);

  return (
    <Star
      className={cn(
        className,
        showSemanticTone && "text-[var(--tone-starred)]",
        showSemanticTone && starred && "fill-[var(--tone-starred)]",
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
