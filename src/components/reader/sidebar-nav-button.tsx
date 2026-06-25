import { cva } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { MotionNumber } from "@/design-system";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { SidebarDensity } from "./sidebar-density";
import { getSidebarDensityTokens } from "./sidebar-density";

type SidebarNavButtonProps = ComponentPropsWithoutRef<"button"> & {
  children?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  activePane?: boolean;
  registerSidebarNavigationTarget?: boolean;
  selectedIndicatorMode?: "always" | "hide-on-row-hover" | "hidden";
  selectedIndicatorTone?: "accent" | "neutral";
  size?: "default" | "compact";
  density?: SidebarDensity;
  contentClassName?: string;
  ref?: Ref<HTMLButtonElement>;
  trailingClassName?: string;
};

const selectedIndicatorVariants = cva(
  "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:transition-opacity before:duration-150",
  {
    variants: {
      tone: {
        accent: "before:bg-primary/85",
        neutral: "before:bg-border-strong/70 before:opacity-70",
      },
    },
    defaultVariants: {
      tone: "accent",
    },
  },
);

export function SidebarNavButton({
  children,
  className,
  contentClassName,
  selected = false,
  activePane: activePaneProp,
  registerSidebarNavigationTarget = true,
  selectedIndicatorMode = "always",
  selectedIndicatorTone = "accent",
  size = "compact",
  density = "normal",
  ref,
  trailing,
  trailingClassName,
  type = "button",
  ...props
}: SidebarNavButtonProps) {
  const tokens = getSidebarDensityTokens(density);
  const focusedPane = useUiStore((state) => state.focusedPane);
  const activePane = activePaneProp ?? focusedPane === "sidebar";
  const trailingClassNames = cn(
    "ml-3 inline-flex min-w-7 shrink-0 justify-end text-right text-[0.75rem] font-medium text-[var(--sidebar-foreground-muted-strong)]",
    selected && activePane && "text-[var(--sidebar-selection-muted)]",
    trailingClassName,
  );

  return (
    <button
      ref={ref}
      type={type}
      data-sidebar-navigation-target={registerSidebarNavigationTarget ? "true" : undefined}
      data-active-pane={selected ? String(activePane) : undefined}
      className={cn(
        "motion-contextual-surface relative flex w-full items-center justify-between overflow-hidden rounded-md text-sm select-none transition-[background-color,color,box-shadow] duration-150 focus:outline-none motion-reduce:transition-none",
        tokens.navButtonPaddingX,
        size === "default" ? "min-h-11 py-2" : tokens.navButton,
        selected
          ? cn(
              activePane
                ? "bg-[image:var(--sidebar-selection-gradient)] text-[var(--sidebar-selection-foreground)] focus-visible:bg-[image:var(--sidebar-selection-gradient)]"
                : "bg-[image:var(--sidebar-hover-gradient)] text-[var(--sidebar-foreground-strong)] focus-visible:bg-[image:var(--sidebar-hover-gradient)]",
              selectedIndicatorMode !== "hidden" &&
                selectedIndicatorVariants({
                  tone: activePane ? selectedIndicatorTone : "neutral",
                }),
              selectedIndicatorMode === "hide-on-row-hover" &&
                "group-hover/feed-row:before:opacity-0 group-focus-within/feed-row:before:opacity-0",
            )
          : "text-[var(--sidebar-foreground-strong)] hover:bg-[var(--sidebar-hover-surface)] hover:text-[var(--sidebar-selection-foreground)] focus-visible:bg-[image:var(--sidebar-focus-gradient)] focus-visible:text-[var(--sidebar-selection-foreground)]",
        className,
      )}
      {...props}
    >
      <span
        className={cn("flex min-w-0 flex-1 items-center justify-start", tokens.navButtonContentGap, contentClassName)}
      >
        {children}
      </span>
      {trailing ? (
        typeof trailing === "string" || typeof trailing === "number" ? (
          <MotionNumber key={trailing} value={trailing} className={trailingClassNames} />
        ) : (
          <span className={trailingClassNames}>{trailing}</span>
        )
      ) : null}
    </button>
  );
}

SidebarNavButton.displayName = "SidebarNavButton";
