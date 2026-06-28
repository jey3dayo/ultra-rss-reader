import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";

export type ArticleListContextStripProps = {
  primaryLabel?: string | null;
  secondaryLabel?: string | null;
  tone?: "unread" | "starred" | null;
};

type ArticleListContextTone = NonNullable<ArticleListContextStripProps["tone"]> | "neutral";

type ArticleListContextToneStyle = {
  primary: string;
  secondary: string;
};

const TONE_STYLES: Record<ArticleListContextTone, ArticleListContextToneStyle> = {
  unread: {
    primary: "text-[var(--sidebar-foreground-soft-strong)]",
    secondary: "text-[var(--sidebar-foreground-soft-strong)]",
  },
  starred: {
    primary: "text-[var(--sidebar-foreground-soft-strong)]",
    secondary: "text-[var(--sidebar-foreground-soft-strong)]",
  },
  neutral: {
    primary: "text-[var(--sidebar-foreground-muted-strong)]",
    secondary: "text-[var(--sidebar-foreground-soft-strong)]",
  },
};

export function ArticleListContextStrip({ primaryLabel, secondaryLabel, tone }: ArticleListContextStripProps) {
  if (!primaryLabel && !secondaryLabel) {
    return null;
  }

  const toneStyle = tone ? TONE_STYLES[tone] : TONE_STYLES.neutral;

  return (
    <div
      data-testid="article-list-context-strip"
      data-style="metadata"
      data-tone={tone ?? "neutral"}
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} flex h-8 select-none items-center justify-between border-b border-[var(--reader-context-border)] bg-transparent px-4`}
    >
      {primaryLabel ? (
        <span data-emphasis="primary" className={`text-[11px] font-medium tracking-[0.04em] ${toneStyle.primary}`}>
          {primaryLabel}
        </span>
      ) : null}
      {secondaryLabel ? (
        <span data-emphasis="secondary" className={`text-[10px] font-medium tracking-[0.04em] ${toneStyle.secondary}`}>
          {secondaryLabel}
        </span>
      ) : null}
    </div>
  );
}
