import { cva } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const debugHudFrameVariants = cva("", {
  variants: {
    surface: {
      panelCollapsed:
        "pointer-events-auto rounded-[22px] border border-white/8 bg-black/42 opacity-100 hover:border-white/12 hover:bg-black/48 focus-within:border-white/14 focus-within:bg-black/54 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.24)]",
      panelExpanded:
        "pointer-events-auto rounded-[22px] border border-white/10 bg-black/54 opacity-100 hover:border-white/12 hover:bg-black/58 focus-within:border-white/14 focus-within:bg-black/62 backdrop-blur-xl shadow-[0_22px_48px_rgba(0,0,0,0.3)]",
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

export function DebugHudFrame({ as, children, className, surface = "panelCollapsed", ...props }: DebugHudFrameProps) {
  const Component = as ?? "div";

  return (
    <Component className={cn(debugHudFrameVariants({ surface }), className)} {...props}>
      {children}
    </Component>
  );
}
