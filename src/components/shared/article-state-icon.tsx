import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StarIconProps, UnreadIconProps } from "./article-state-icon.types";

export function UnreadIcon({ unread, className }: UnreadIconProps) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full",
        unread ? "bg-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,0.45)]" : "border-2 border-current/85",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function StarIcon({ starred, className, ...props }: StarIconProps) {
  return <Star className={cn(className, starred && "fill-yellow-400 text-yellow-400")} aria-hidden="true" {...props} />;
}
