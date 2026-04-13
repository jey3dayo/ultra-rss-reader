import type { Star } from "lucide-react";
import type { ComponentProps } from "react";

export type UnreadIconProps = {
  unread: boolean;
  className?: string;
};

export type StarIconProps = {
  starred: boolean;
  className?: string;
} & ComponentProps<typeof Star>;
