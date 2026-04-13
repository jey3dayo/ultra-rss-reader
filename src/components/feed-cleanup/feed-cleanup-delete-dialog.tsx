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
  candidate,
  open,
  title,
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{candidate?.title ?? ""}</p>
          <p>
            {latestArticleLabel}: {formatDate(candidate?.latestArticleAt ?? null, dateLocale)}
          </p>
          <p>
            {unreadCountLabel}: {candidate?.unreadCount ?? 0}
          </p>
          <p>
            {starredCountLabel}: {candidate?.starredCount ?? 0}
          </p>
          <div className="space-y-2">
            <p className="text-foreground">{reasonsLabel}</p>
            <ul className="space-y-1">
              {candidate?.reasonKeys.map((reason) => (
                <li key={reason}>{reasonLabels[reason]}</li>
              ))}
            </ul>
          </div>
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
