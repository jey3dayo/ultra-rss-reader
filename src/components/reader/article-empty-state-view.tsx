import { cn } from "@/lib/utils";
import { ReaderPassiveActionButton } from "./reader-passive-action-button";

type ArticleEmptyStateViewProps = {
  eyebrow?: string;
  message: string;
  description?: string;
  hints?: string[];
  containerClassName?: string;
  cardClassName?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "link";
  }>;
};

const EMPTY_HINTS: string[] = [];
const EMPTY_ACTIONS: NonNullable<ArticleEmptyStateViewProps["actions"]> = [];

export function ArticleEmptyStateView({
  eyebrow,
  message,
  description,
  hints = EMPTY_HINTS,
  containerClassName,
  cardClassName,
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
        className={cn(
          "relative w-full max-w-[40rem] overflow-hidden rounded-xl border border-border/75 bg-surface-1/72 px-6 py-6 text-left text-foreground-soft shadow-[var(--shadow-elevation-1)] dark:border-border/90 dark:bg-surface-2/72",
          hints.length > 0 && "min-h-44",
          cardClassName,
        )}
      >
        {eyebrow ? (
          <div className="mb-4 inline-flex rounded-full border border-border/70 bg-surface-1/88 px-3 py-1 text-[0.68rem] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            {eyebrow}
          </div>
        ) : null}
        <p className="max-w-[28rem] text-left text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground">
          {message}
        </p>
        {description ? (
          <p className="mt-3 max-w-[29rem] text-[0.97rem] leading-6 text-foreground-soft">{description}</p>
        ) : null}
        {actions.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
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
          <ul className="mt-7 max-w-[29rem] list-disc space-y-2.5 border-t border-border/55 pt-5 pl-5 text-left text-sm leading-6 marker:text-foreground-soft dark:border-border/75">
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
