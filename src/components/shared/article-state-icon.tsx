import { Star } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type UnreadIconProps = {
  unread: boolean;
  forceTone?: boolean;
  tone?: "state" | "none";
  className?: string;
};

type StarIconProps = {
  starred: boolean;
  forceTone?: boolean;
  tone?: "state" | "none";
  className?: string;
} & ComponentProps<typeof Star>;

export function UnreadIcon({ unread, forceTone = false, tone = "state", className }: UnreadIconProps) {
  const showSemanticTone = tone === "state" && (unread || forceTone);

  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full",
        showSemanticTone && "text-[var(--tone-unread)] border-[var(--tone-unread-border)]",
        unread
          ? showSemanticTone
            ? "bg-[var(--tone-unread)] shadow-[var(--tone-unread-shadow)]"
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
  const fill = showSemanticTone && starred ? "currentColor" : "none";

  return (
    <Star
      fill={fill}
      className={cn(
        className,
        showSemanticTone && "text-[var(--tone-starred)]",
        showSemanticTone && starred && "fill-current stroke-current",
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
