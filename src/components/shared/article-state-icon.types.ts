import type { Star } from "lucide-react";
import type { ComponentProps } from "react";

export type UnreadIconProps = {
  unread: boolean;
  forceTone?: boolean;
  tone?: "state" | "none";
  className?: string;
};

export type StarIconProps = {
  starred: boolean;
  forceTone?: boolean;
  tone?: "state" | "none";
  className?: string;
} & ComponentProps<typeof Star>;
