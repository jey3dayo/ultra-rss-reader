import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const surfaceCardVariants = cva(
  "motion-contextual-surface border text-card-foreground shadow-elevation-1 transition-[background-color,border-color,box-shadow]",
  {
    variants: {
      variant: {
        info: "rounded-md",
        section: "rounded-md",
      },
      frame: {
        default: "",
        borderless: "",
      },
      tone: {
        default: "",
        subtle: "",
        emphasis: "",
        success: "",
        warning: "",
        danger: "",
      },
      padding: {
        compact: "px-3 py-3",
        default: "px-4 py-4 sm:px-5 sm:py-5",
        spacious: "px-7 py-7",
      },
    },
    compoundVariants: [
      {
        variant: "info",
        tone: "default",
        className: "border-border/70 bg-card/70",
      },
      {
        variant: "info",
        tone: "subtle",
        className: "border-border/60 bg-surface-1/85",
      },
      {
        variant: "info",
        tone: "emphasis",
        className: "border-border-strong bg-surface-1",
      },
      {
        variant: "section",
        tone: "default",
        className: "border-border/60 bg-card/36",
      },
      {
        variant: "section",
        tone: "subtle",
        className: "border-border/55 bg-card/24",
      },
      {
        variant: "section",
        tone: "emphasis",
        className: "border-border-strong bg-card/52",
      },
      {
        tone: "success",
        className: "border-state-success-border bg-state-success-surface text-state-success-foreground",
      },
      {
        tone: "warning",
        className: "border-state-warning-border bg-state-warning-surface text-state-warning-foreground",
      },
      {
        tone: "danger",
        className: "border-state-danger-border bg-state-danger-surface text-state-danger-foreground",
      },
      {
        frame: "borderless",
        className: "border-transparent shadow-none",
      },
    ],
    defaultVariants: {
      frame: "default",
      tone: "default",
      padding: "default",
    },
  },
);

type SurfaceCardVariantProps = VariantProps<typeof surfaceCardVariants>;

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> &
  Omit<SurfaceCardVariantProps, "variant"> & {
    variant: NonNullable<SurfaceCardVariantProps["variant"]>;
  };

export function SurfaceCard({ variant, frame, tone, padding, className, ...props }: SurfaceCardProps) {
  return (
    <div
      {...props}
      data-surface-card={variant}
      className={cn(surfaceCardVariants({ variant, frame, tone, padding }), className)}
    />
  );
}
