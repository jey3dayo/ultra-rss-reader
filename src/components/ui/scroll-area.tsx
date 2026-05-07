import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";
import type { ScrollAreaProps } from "./scroll-area.types";

type ScrollBarProps = ScrollAreaPrimitive.Scrollbar.Props & {
  thumbClassName?: string;
};

function ScrollArea({
  className,
  children,
  contentClassName,
  scrollbarClassName,
  thumbClassName,
  viewportRef,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn("relative min-h-0", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow,outline-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:outline-1 focus-visible:outline-border/80 focus-visible:ring-2 focus-visible:ring-border/35 motion-reduce:transition-none"
      >
        {contentClassName ? (
          <div data-slot="scroll-area-content" className={contentClassName}>
            {children}
          </div>
        ) : (
          children
        )}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar className={scrollbarClassName} thumbClassName={thumbClassName} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({ className, thumbClassName, orientation = "vertical", ...props }: ScrollBarProps) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn("relative flex-1 rounded-full bg-border", thumbClassName)}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
