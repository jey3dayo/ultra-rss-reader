import type { CSSProperties } from "react";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_CONTENT_SWAP_SLOW_DURATION_MS,
  MOTION_CONTENT_SWAP_SLOW_OFFSET_PX,
  MOTION_DATA_PHASE_ATTRIBUTE,
  MOTION_PHASE_ENTERING,
} from "@/constants";
import { cn } from "@/lib/utils";
import { ReaderPassiveActionButton } from "./reader-passive-action-button";

type ArticleEmptyStateViewProps = {
  eyebrow?: string;
  message: string;
  description?: string;
  hints?: string[];
  containerClassName?: string;
  cardClassName?: string;
  animateCardEntrance?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "link";
  }>;
};

const EMPTY_HINTS: string[] = [];
const EMPTY_ACTIONS: NonNullable<ArticleEmptyStateViewProps["actions"]> = [];
type EmptyStateMotionStyle = CSSProperties &
  Record<"--motion-content-swap-offset" | "--motion-duration-content-swap", string>;
const EMPTY_STATE_MOTION_STYLE: EmptyStateMotionStyle = {
  "--motion-content-swap-offset": MOTION_CONTENT_SWAP_SLOW_OFFSET_PX,
  "--motion-duration-content-swap": MOTION_CONTENT_SWAP_SLOW_DURATION_MS,
};

export function ArticleEmptyStateView({
  eyebrow,
  message,
  description,
  hints = EMPTY_HINTS,
  containerClassName,
  cardClassName,
  animateCardEntrance = false,
  actions = EMPTY_ACTIONS,
}: ArticleEmptyStateViewProps) {
  return (
    <div
      className={cn(
        "relative flex flex-1 items-center justify-center overflow-hidden px-6 pt-6 pb-12",
        containerClassName,
      )}
    >
      <div
        {...(animateCardEntrance ? { [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING } : {})}
        className={cn(
          animateCardEntrance && MOTION_CONTENT_SWAP_CLASS_NAME,
          "relative flex w-full max-w-[26rem] flex-col items-center text-center text-foreground-soft",
          cardClassName,
        )}
        style={animateCardEntrance ? EMPTY_STATE_MOTION_STYLE : undefined}
      >
        {eyebrow ? (
          <p className="mb-3 text-[0.68rem] font-medium tracking-[0.14em] text-foreground-soft uppercase">{eyebrow}</p>
        ) : null}
        <p className="text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">{message}</p>
        {description ? <p className="mt-2.5 text-[0.97rem] leading-6 text-foreground-soft">{description}</p> : null}
        {actions.length > 0 ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {actions.map((action) => (
              <ReaderPassiveActionButton
                key={action.label}
                variant={action.variant ?? "default"}
                onClick={action.onClick}
              >
                {action.label}
              </ReaderPassiveActionButton>
            ))}
          </div>
        ) : null}
        {hints.length > 0 ? (
          <ul className="mt-6 space-y-1.5 text-center text-sm leading-6 text-foreground-soft/90">
            {hints.map((hint) => (
              <li key={hint} className="leading-6">
                {hint}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
