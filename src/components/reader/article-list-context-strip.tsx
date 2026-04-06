type ArticleListContextStripProps = {
  primaryLabel?: string | null;
  secondaryLabel?: string | null;
};

export function ArticleListContextStrip({ primaryLabel, secondaryLabel }: ArticleListContextStripProps) {
  if (!primaryLabel && !secondaryLabel) {
    return null;
  }

  return (
    <div className="flex min-h-9 items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
      {primaryLabel ? (
        <span
          data-emphasis="primary"
          className="rounded-full border border-foreground/15 bg-foreground px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] text-background uppercase"
        >
          {primaryLabel}
        </span>
      ) : null}
      {secondaryLabel ? (
        <span
          data-emphasis="secondary"
          className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase"
        >
          {secondaryLabel}
        </span>
      ) : null}
    </div>
  );
}
