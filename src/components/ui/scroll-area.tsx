import { cn } from "cn";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import type { ScrollAreaProps } from "./scroll-area.types";

type ScrollBarProps = Omit<ComponentProps<"div">, "children"> & {
  keepMounted?: boolean;
  orientation?: "horizontal" | "vertical";
  thumbClassName?: string;
};

const scrollBarOrientationClassNames = {
  horizontal: "h-2.5 flex-col border-t border-t-transparent",
  vertical: "h-full w-2.5 border-l border-l-transparent",
} satisfies Record<NonNullable<ScrollBarProps["orientation"]>, string>;

function ScrollArea({
  className,
  children,
  contentClassName,
  keyboardScrollable,
  scrollbarClassName: _scrollbarClassName,
  thumbClassName: _thumbClassName,
  viewportRef,
  ...props
}: ScrollAreaProps) {
  const innerViewportRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      innerViewportRef.current = node;
      if (typeof viewportRef === "function") {
        viewportRef(node);
      } else if (viewportRef) {
        viewportRef.current = node;
      }
    },
    [viewportRef],
  );

  useEffect(() => {
    const viewport = innerViewportRef.current;
    if (!keyboardScrollable || !viewport) {
      return;
    }

    const measure = () => {
      setOverflowing(viewport.scrollHeight > viewport.clientHeight || viewport.scrollWidth > viewport.clientWidth);
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    for (const child of viewport.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [keyboardScrollable]);

  return (
    <div data-slot="scroll-area" className={cn("relative min-h-0", className)} {...props}>
      <div
        ref={setViewport}
        {...(keyboardScrollable ? { tabIndex: overflowing ? 0 : -1 } : {})}
        data-slot="scroll-area-viewport"
        className="size-full overflow-auto rounded-[inherit] transition-[color,box-shadow,outline-color] duration-150 ease-standard outline-none focus-visible:outline-1 focus-visible:outline-border/80 focus-visible:ring-2 focus-visible:ring-border/35 motion-reduce:transition-none"
      >
        {contentClassName ? (
          <div data-slot="scroll-area-content" className={contentClassName}>
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function ScrollBar({
  className,
  keepMounted: _keepMounted,
  thumbClassName,
  orientation = "vertical",
  ...props
}: ScrollBarProps) {
  return (
    <div
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors duration-150 ease-standard select-none motion-reduce:transition-none",
        scrollBarOrientationClassNames[orientation],
        className,
      )}
      {...props}
    >
      <div data-slot="scroll-area-thumb" className={cn("relative flex-1 rounded-full bg-border", thumbClassName)} />
    </div>
  );
}

export type { ScrollAreaProps } from "./scroll-area.types";
export { ScrollArea, ScrollBar };
