import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getSidebarDensityTokens, type SidebarDensity } from "./sidebar-density";

type SidebarLeadingControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  density?: SidebarDensity;
  children: ReactNode;
  visibleMode?: "always" | "on-row-hover";
};

export function SidebarLeadingControlButton({
  density = "normal",
  children,
  className,
  visibleMode = "always",
  type = "button",
  ...props
}: SidebarLeadingControlButtonProps) {
  const tokens = getSidebarDensityTokens(density);

  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
        tokens.leadingControl,
        visibleMode === "on-row-hover" &&
          "opacity-0 transition-opacity group-hover/feed-row:opacity-100 group-focus-within/feed-row:opacity-100 focus-visible:opacity-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
