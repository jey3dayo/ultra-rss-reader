import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StarIconProps, UnreadIconProps } from "./article-state-icon.types";

export function UnreadIcon({ unread, className }: UnreadIconProps) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full",
        unread
          ? "bg-[var(--tone-unread)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--tone-unread)_45%,transparent)]"
          : "border-2 border-current/85",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function StarIcon({ starred, className, ...props }: StarIconProps) {
  return (
    <Star
      className={cn(className, starred && "fill-[var(--tone-starred)] text-[var(--tone-starred)]")}
      aria-hidden="true"
      {...props}
    />
  );
}
