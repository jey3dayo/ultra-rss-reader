import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { useReaderPassiveLayoutCard } from "./hooks/use-reader-passive-layout-context";
import { ReaderPassiveActionButton } from "./reader-passive-action-button";
import {
  ReaderPassiveCard,
  readerListPassiveCardOffsetClassName,
  readerPassiveCardClassName,
  readerPassiveCardPaddingClassName,
} from "./reader-passive-card";

export type ArticleListEmptyStateVariant = "default" | "setup" | "hidden";

type PassiveCard = ReturnType<typeof useReaderPassiveLayoutCard>;

type ArticleListEmptyStateProps = {
  variant: ArticleListEmptyStateVariant;
  passiveCard: PassiveCard;
  message: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type EmptyStateDetailsProps = {
  descriptionClassName: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function EmptyStateDetails({ descriptionClassName, description, actionLabel, onAction }: EmptyStateDetailsProps) {
  return (
    <>
      {description ? <p className={descriptionClassName}>{description}</p> : null}
      {actionLabel && onAction ? (
        <ReaderPassiveActionButton variant="outline" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </ReaderPassiveActionButton>
      ) : null}
    </>
  );
}

function resolveContainerClassName(variant: ArticleListEmptyStateVariant, passiveCardEnabled: boolean): string {
  if (variant === "hidden") {
    return "h-full";
  }
  if (variant === "default" && passiveCardEnabled) {
    return "flex justify-center px-6 pb-6";
  }
  return "flex h-full items-center justify-center p-6";
}

function resolveDefaultCardStyle(passiveCard: PassiveCard) {
  if (!passiveCard.enabled) {
    return undefined;
  }
  return passiveCard.isMeasured ? { marginTop: passiveCard.offsetPx } : { visibility: "hidden" as const };
}

export function ArticleListEmptyState({
  variant,
  passiveCard,
  message,
  description,
  actionLabel,
  onAction,
}: ArticleListEmptyStateProps) {
  return (
    <div className={resolveContainerClassName(variant, passiveCard.enabled)}>
      {variant === "setup" ? (
        <ReaderPassiveCard className="w-full max-w-sm rounded-md border border-border/65 bg-surface-1/48 px-7 py-6 text-left shadow-[0_18px_48px_-40px_rgba(38,37,30,0.18)] dark:border-border/75 dark:bg-[rgba(38,34,29,0.52)] dark:shadow-none">
          <p className="text-base font-medium leading-6 tracking-[-0.01em] text-foreground">{message}</p>
          <EmptyStateDetails
            descriptionClassName="mt-2 text-sm leading-6 text-foreground-soft"
            description={description}
            actionLabel={actionLabel}
            onAction={onAction}
          />
        </ReaderPassiveCard>
      ) : null}
      {variant === "default" ? (
        <div
          ref={passiveCard.cardRef}
          className={cn(
            "flex w-full max-w-[17rem] flex-col items-center text-center",
            readerPassiveCardClassName,
            readerPassiveCardPaddingClassName,
            !passiveCard.enabled && readerListPassiveCardOffsetClassName,
          )}
          style={resolveDefaultCardStyle(passiveCard)}
          data-testid="article-list-empty-state"
          data-passive-layout-mode={passiveCard.enabled ? passiveCard.mode : undefined}
        >
          <Inbox aria-hidden="true" className="size-9 text-foreground-soft/60" strokeWidth={1.5} />
          <p className="mt-3 text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">{message}</p>
          <EmptyStateDetails
            descriptionClassName="mt-1.5 text-sm leading-6 text-foreground-soft"
            description={description}
            actionLabel={actionLabel}
            onAction={onAction}
          />
        </div>
      ) : null}
    </div>
  );
}
