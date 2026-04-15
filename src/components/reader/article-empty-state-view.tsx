import type { ArticleEmptyStateViewProps } from "./article-view.types";

const EMPTY_HINTS: string[] = [];

export function ArticleEmptyStateView({ message, hints = EMPTY_HINTS }: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
      <div className="max-w-md rounded-2xl border border-border/70 bg-card/70 px-6 py-5 text-left text-muted-foreground shadow-elevation-2">
        <p className="text-left text-base font-medium text-foreground">{message}</p>
        {hints.length > 0 ? (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-left text-sm marker:text-primary/80">
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
