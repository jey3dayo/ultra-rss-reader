import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArticleEmptyStateViewProps } from "./article-view.types";

const EMPTY_HINTS: string[] = [];

export function ArticleEmptyStateView({
  eyebrow,
  message,
  description,
  hints = EMPTY_HINTS,
  actions = [],
}: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div
        className={cn(
          "w-full max-w-2xl overflow-hidden rounded-3xl border border-border/80 bg-[linear-gradient(180deg,rgba(247,247,244,0.94)_0%,rgba(242,241,237,0.9)_100%)] px-7 py-7 text-left text-foreground-soft shadow-[0_28px_70px_-44px_rgba(38,37,30,0.28)]",
          hints.length > 0 && "min-h-44",
        )}
      >
        {eyebrow ? (
          <div className="mb-4 inline-flex rounded-full border border-border/70 bg-surface-1/88 px-3 py-1 text-[0.68rem] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            {eyebrow}
          </div>
        ) : null}
        <p className="max-w-xl text-left text-[1.85rem] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground">
          {message}
        </p>
        {description ? <p className="mt-3 max-w-xl text-sm leading-6 text-foreground-soft">{description}</p> : null}
        {actions.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button key={action.label} type="button" variant={action.variant ?? "default"} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
        {hints.length > 0 ? (
          <ul className="mt-6 list-disc space-y-2.5 border-t border-border/70 pt-5 pl-5 text-left text-sm leading-6 marker:text-foreground-soft">
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
