import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FeedCleanupCandidate } from "@/lib/feed-cleanup";

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
}: {
  candidate: FeedCleanupCandidate | null;
  open: boolean;
  title: string;
  dateLocale: string;
  cancelLabel: string;
  deleteLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonsLabel: string;
  reasonLabels: Record<FeedCleanupCandidate["reasonKeys"][number], string>;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <DeleteButton onClick={onConfirm} disabled={pending}>
            {deleteLabel}
          </DeleteButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
