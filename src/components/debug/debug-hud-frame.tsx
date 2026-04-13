import { cva } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const debugHudFrameVariants = cva("", {
  variants: {
    surface: {
      panelCollapsed:
        "pointer-events-auto rounded-2xl border border-white/6 bg-black/56 opacity-80 hover:border-white/10 hover:bg-black/40 hover:opacity-35 focus-within:border-white/14 focus-within:bg-black/72 focus-within:opacity-100 backdrop-blur-md shadow-[0_14px_30px_rgba(0,0,0,0.22)]",
      panelExpanded:
        "pointer-events-auto rounded-2xl border border-white/8 bg-black/76 opacity-88 hover:opacity-60 focus-within:opacity-100 backdrop-blur-md shadow-[0_16px_38px_rgba(0,0,0,0.36)]",
      strip:
        "pointer-events-none mx-auto flex min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/12 bg-black/62 px-4 py-2 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]",
      stripCompact:
        "pointer-events-none mx-auto flex min-w-0 max-w-full items-center justify-start gap-2 overflow-x-auto rounded-2xl border border-white/12 bg-black/68 px-3 py-1.5 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]",
    },
  },
  defaultVariants: {
    surface: "panelCollapsed",
  },
});

type DebugHudFrameSurface = NonNullable<Parameters<typeof debugHudFrameVariants>[0]>["surface"];

type DebugHudFrameProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  surface?: DebugHudFrameSurface;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">;

export function DebugHudFrame({
  as,
  children,
  className,
  surface = "panelCollapsed",
  ...props
}: DebugHudFrameProps) {
  const Component = as ?? "div";

  return (
    <Component className={cn(debugHudFrameVariants({ surface }), className)} {...props}>
      {children}
    </Component>
  );
}
