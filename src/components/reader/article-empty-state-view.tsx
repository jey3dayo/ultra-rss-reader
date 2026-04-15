import type { ArticleEmptyStateViewProps } from "./article-view.types";

const EMPTY_HINTS: string[] = [];

export function ArticleEmptyStateView({ message, hints = EMPTY_HINTS }: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
      <div className="max-w-xl rounded-[2rem] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--background)/0.98))] px-7 py-7 text-left text-muted-foreground shadow-[0_28px_80px_-54px_hsl(var(--foreground)/0.55)]">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">Reader</p>
        <p className="text-left text-[1.35rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {message}
        </p>
        {hints.length > 0 ? (
          <ul className="mt-5 list-disc space-y-2.5 border-t border-border/60 pt-5 pl-5 text-left text-sm leading-6 marker:text-primary/80">
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
