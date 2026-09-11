import { cva } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { MOTION_DATA_SIDEBAR_BADGE_LEAVING_ATTRIBUTE, MOTION_SIDEBAR_BADGE_CLASS_NAME } from "@/constants";
import { MotionNumber, SIDEBAR_RIGHT_RAIL_CLASS_NAME } from "@/design-system";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useSidebarNavButtonTrailing } from "./hooks/sidebar/use-sidebar-nav-button-trailing";
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
  /**
   * Keeps rendering the last non-empty `trailing` value, fading it out
   * instead of unmounting it the instant `trailing` becomes empty (e.g. an
   * unread count dropping to 0). Opt-in: callers that rely on `trailing`
   * disappearing immediately (smart views, tag list, the account service
   * picker) must not set this.
   */
  trailingKeepLastOnClear?: boolean;
};

type SidebarNavButtonTrailingBadgeProps = {
  trailing: ReactNode;
  isLeaving: boolean;
  className: string;
};

function SidebarNavButtonTrailingBadge({ trailing, isLeaving, className }: SidebarNavButtonTrailingBadgeProps) {
  if (trailing === null || trailing === undefined) {
    return null;
  }
  return (
    <span
      className={MOTION_SIDEBAR_BADGE_CLASS_NAME}
      aria-hidden={isLeaving ? "true" : undefined}
      {...{ [MOTION_DATA_SIDEBAR_BADGE_LEAVING_ATTRIBUTE]: isLeaving ? "true" : undefined }}
    >
      {typeof trailing === "string" || typeof trailing === "number" ? (
        <MotionNumber key={trailing} value={trailing} className={className} />
      ) : (
        <span className={className}>{trailing}</span>
      )}
    </span>
  );
}

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
  trailingKeepLastOnClear = false,
  type = "button",
  ...props
}: SidebarNavButtonProps) {
  const tokens = getSidebarDensityTokens(density);
  const focusedPane = useUiStore((state) => state.focusedPane);
  const activePane = activePaneProp ?? focusedPane === "sidebar";
  const trailingClassNames = cn(
    SIDEBAR_RIGHT_RAIL_CLASS_NAME,
    "text-[0.75rem] font-medium text-[var(--sidebar-foreground-muted-strong)]",
    selected && activePane && "text-[var(--sidebar-selection-muted)]",
    trailingClassName,
  );

  const { trailing: resolvedTrailing, isLeaving: trailingIsLeaving } = useSidebarNavButtonTrailing({
    trailing,
    keepLastOnClear: trailingKeepLastOnClear,
  });

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
                : "bg-[image:var(--sidebar-selection-gradient)] text-[var(--sidebar-foreground-strong)] focus-visible:bg-[image:var(--sidebar-selection-gradient)]",
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
      <SidebarNavButtonTrailingBadge
        trailing={resolvedTrailing}
        isLeaving={trailingIsLeaving}
        className={trailingClassNames}
      />
    </button>
  );
}

SidebarNavButton.displayName = "SidebarNavButton";
