import { DestructiveDialogFooter } from "@/components/shared/destructive-dialog-footer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FeedCleanupDeleteDialogProps } from "./feed-cleanup.types";

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FeedCleanupDeleteDialog({
  candidates,
  open,
  title,
  bulkTitle,
  bulkSummary,
  warningLabel,
  dateLocale,
  cancelLabel,
  deleteLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonsLabel,
  reasonLabels,
  pending,
  onOpenChange,
  onConfirm,
}: FeedCleanupDeleteDialogProps) {
  const primaryCandidate = candidates[0] ?? null;
  const bulkDelete = candidates.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bulkDelete ? bulkTitle : title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{bulkDelete ? bulkSummary : (primaryCandidate?.title ?? "")}</p>
          <p className="rounded-md border border-state-danger-border bg-state-danger-surface px-3 py-2 text-sm text-state-danger-foreground">
            {warningLabel}
          </p>
          {bulkDelete ? (
            <ul className="space-y-1">
              {candidates.map((candidate) => (
                <li key={candidate.feedId}>{candidate.title}</li>
              ))}
            </ul>
          ) : (
            <>
              <p>
                {latestArticleLabel}: {formatDate(primaryCandidate?.latestArticleAt ?? null, dateLocale)}
              </p>
              <p>
                {unreadCountLabel}: {primaryCandidate?.unreadCount ?? 0}
              </p>
              <p>
                {starredCountLabel}: {primaryCandidate?.starredCount ?? 0}
              </p>
              <div className="space-y-2">
                <p className="text-foreground">{reasonsLabel}</p>
                <ul className="space-y-1">
                  {primaryCandidate?.reasonKeys.map((reason) => (
                    <li key={reason}>{reasonLabels[reason]}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
        <DestructiveDialogFooter
          cancelLabel={cancelLabel}
          confirmLabel={deleteLabel}
          pending={pending}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
