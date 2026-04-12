import type { ComponentProps } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type UnreadIconProps = {
  unread: boolean;
  className?: string;
};

type StarIconProps = {
  starred: boolean;
  className?: string;
} & ComponentProps<typeof Star>;

export function UnreadIcon({ unread, className }: UnreadIconProps) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full",
        unread ? "bg-blue-400" : "border-2 border-current",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function StarIcon({ starred, className, ...props }: StarIconProps) {
  return (
    <Star
      className={cn(className, starred && "fill-yellow-400 text-yellow-400")}
      aria-hidden="true"
      {...props}
    />
  );
}
