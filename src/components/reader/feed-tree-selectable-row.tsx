import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type FeedTreeSelectableRowProps = {
  rowClassName?: string;
  rowStyle?: CSSProperties;
  rowProps?: Record<string, string>;
  selected: boolean;
  selectedIndicatorProps?: Record<string, string>;
  selectedIndicatorClassName?: string;
  leadingControl?: ReactNode;
  leadingControlAnchorProps?: Record<string, string>;
  leadingControlAnchorClassName?: string;
  children: ReactNode;
};

export function FeedTreeSelectableRow({
  rowClassName,
  rowStyle,
  rowProps,
  selected,
  selectedIndicatorProps,
  selectedIndicatorClassName,
  leadingControl,
  leadingControlAnchorProps,
  leadingControlAnchorClassName,
  children,
}: FeedTreeSelectableRowProps) {
  return (
    <div className={cn("relative", rowClassName)} style={rowStyle} {...rowProps}>
      {selected ? (
        <span
          aria-hidden="true"
          {...selectedIndicatorProps}
          className={cn(
            "pointer-events-none absolute inset-y-1.5 left-[var(--feed-tree-rail-offset)] z-0 w-0.5 rounded-full bg-primary/85 transition-[opacity,transform,background-color] duration-200 ease-standard motion-reduce:transition-none",
            selectedIndicatorClassName,
          )}
        />
      ) : null}
      {leadingControl ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-[var(--feed-tree-rail-offset)] z-10 flex -translate-x-1/2 items-center",
            leadingControlAnchorClassName,
          )}
          {...leadingControlAnchorProps}
        >
          <div className="pointer-events-auto">{leadingControl}</div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
