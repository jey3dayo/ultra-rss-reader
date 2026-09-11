import { cva } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { useEffect, useState } from "react";
import {
  MOTION_DATA_SIDEBAR_BADGE_LEAVING_ATTRIBUTE,
  MOTION_SIDEBAR_BADGE_CLASS_NAME,
  MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS,
} from "@/constants";
import { MotionNumber, SIDEBAR_RIGHT_RAIL_CLASS_NAME } from "@/design-system";
import { readMatchMedia, subscribeMatchMediaChange } from "@/lib/runtime/match-media-listener";
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
  /**
   * Keeps rendering the last non-empty `trailing` value, fading it out
   * instead of unmounting it the instant `trailing` becomes empty (e.g. an
   * unread count dropping to 0). Opt-in: callers that rely on `trailing`
   * disappearing immediately (smart views, tag list, the account service
   * picker) must not set this.
   */
  trailingKeepLastOnClear?: boolean;
};

function isTrailingEmpty(trailing: ReactNode): boolean {
  return trailing === null || trailing === undefined;
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

  const [lastTrailing, setLastTrailing] = useState<ReactNode>(trailing);

  // Holds a cleared `trailing` value visible for MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS so it can
  // fade out instead of unmounting instantly, then drops it so the row reclaims the rail width.
  // The effect's own dependency on `lastTrailing` re-runs it once the timer clears that value,
  // which the guard below turns into a no-op instead of restarting the fade.
  useEffect(() => {
    if (!isTrailingEmpty(trailing)) {
      setLastTrailing(trailing);
      return;
    }

    if (!trailingKeepLastOnClear || isTrailingEmpty(lastTrailing)) {
      return;
    }

    const reducedMotionQuery = readMatchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotionQuery?.matches) {
      setLastTrailing(null);
      return;
    }

    let timeoutId: number | undefined = window.setTimeout(() => {
      timeoutId = undefined;
      setLastTrailing(null);
    }, MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS);

    // If reduced motion turns on mid-fade, the CSS token already jumps to 0ms;
    // cancel the timer and unmount right away instead of leaving the rail
    // width reserved for the rest of the duration.
    const unsubscribeReducedMotion = reducedMotionQuery
      ? subscribeMatchMediaChange(reducedMotionQuery, (event) => {
          if (!event.matches) {
            return;
          }
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          setLastTrailing(null);
        })
      : () => {};

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      unsubscribeReducedMotion();
    };
  }, [trailing, trailingKeepLastOnClear, lastTrailing]);

  const trailingIsLeaving = trailingKeepLastOnClear && isTrailingEmpty(trailing) && !isTrailingEmpty(lastTrailing);
  const resolvedTrailing = trailingIsLeaving ? lastTrailing : trailing;

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
      {resolvedTrailing ? (
        <span
          className={MOTION_SIDEBAR_BADGE_CLASS_NAME}
          aria-hidden={trailingIsLeaving ? "true" : undefined}
          {...{ [MOTION_DATA_SIDEBAR_BADGE_LEAVING_ATTRIBUTE]: trailingIsLeaving ? "true" : undefined }}
        >
          {typeof resolvedTrailing === "string" || typeof resolvedTrailing === "number" ? (
            <MotionNumber key={resolvedTrailing} value={resolvedTrailing} className={trailingClassNames} />
          ) : (
            <span className={trailingClassNames}>{resolvedTrailing}</span>
          )}
        </span>
      ) : null}
    </button>
  );
}

SidebarNavButton.displayName = "SidebarNavButton";
