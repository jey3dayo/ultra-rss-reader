export type ArticleListContextStripProps = {
  primaryLabel?: string | null;
  secondaryLabel?: string | null;
  tone?: "unread" | "starred" | null;
};

const TONE_STYLES = {
  unread: {
    accent: "bg-blue-400/80",
    primary: "text-blue-300",
    secondary: "text-blue-200/70",
  },
  starred: {
    accent: "bg-yellow-400/85",
    primary: "text-yellow-300",
    secondary: "text-yellow-200/75",
  },
  neutral: {
    accent: "bg-border",
    primary: "text-muted-foreground",
    secondary: "text-muted-foreground/80",
  },
} as const;

export function ArticleListContextStrip({ primaryLabel, secondaryLabel, tone }: ArticleListContextStripProps) {
  if (!primaryLabel && !secondaryLabel) {
    return null;
  }

  const toneStyle = tone ? TONE_STYLES[tone] : TONE_STYLES.neutral;

  return (
    <div
      data-testid="article-list-context-strip"
      data-style="band"
      data-tone={tone ?? "neutral"}
      className="relative flex items-center justify-between border-b border-border/80 bg-card/95 px-4 py-1.5"
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-3 w-px -translate-y-1/2 rounded-full ${toneStyle.accent}`}
      />
      {primaryLabel ? (
        <span
          data-emphasis="primary"
          className={`text-[11px] font-medium tracking-[0.14em] uppercase ${toneStyle.primary}`}
        >
          {primaryLabel}
        </span>
      ) : null}
      {secondaryLabel ? (
        <span
          data-emphasis="secondary"
          className={`text-[10px] font-medium tracking-[0.14em] uppercase ${toneStyle.secondary}`}
        >
          {secondaryLabel}
        </span>
      ) : null}
    </div>
  );
}
