export type ArticleEmptyStateViewProps = {
  message: string;
  hints?: string[];
};

export function ArticleEmptyStateView({ message, hints = [] }: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
      <div className="max-w-md rounded-2xl border border-white/8 bg-white/[0.03] px-6 py-5 text-left text-muted-foreground shadow-[0_20px_40px_rgba(0,0,0,0.16)]">
        <p className="text-left text-base font-medium text-foreground">{message}</p>
        {hints.length > 0 ? (
          <ul className="mt-4 space-y-2 text-left text-sm">
            {hints.map((hint) => (
              <li key={hint} className="flex items-start justify-start gap-2">
                <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
