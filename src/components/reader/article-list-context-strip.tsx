import type { ArticleListContextStripProps } from "./article-list.types";

const TONE_STYLES = {
  unread: {
    accent: "bg-[var(--tone-unread)]",
    primary:
      "text-[color-mix(in_srgb,var(--tone-unread)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))] font-semibold",
    secondary:
      "text-[color-mix(in_srgb,var(--tone-unread)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))] opacity-80",
  },
  starred: {
    accent: "bg-[var(--tone-starred)]",
    primary:
      "text-[color-mix(in_srgb,var(--tone-starred)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]",
    secondary:
      "text-[color-mix(in_srgb,var(--tone-starred)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))] opacity-80",
  },
  neutral: {
    accent: "bg-[var(--sidebar-divider-strong)]",
    primary: "text-[var(--sidebar-foreground-muted-strong)]",
    secondary: "text-[var(--sidebar-foreground-soft-strong)]",
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
      className="relative flex items-center justify-between border-b border-[var(--reader-context-border)] bg-card/95 px-4 py-1.5"
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-3 w-px -translate-y-1/2 rounded-full ${toneStyle.accent}`}
      />
      {primaryLabel ? (
        <span
          data-emphasis="primary"
          className={`text-[11px] font-medium tracking-[0.12em] uppercase ${toneStyle.primary}`}
        >
          {primaryLabel}
        </span>
      ) : null}
      {secondaryLabel ? (
        <span
          data-emphasis="secondary"
          className={`text-[10px] font-medium tracking-[0.12em] uppercase ${toneStyle.secondary}`}
        >
          {secondaryLabel}
        </span>
      ) : null}
    </div>
  );
}
