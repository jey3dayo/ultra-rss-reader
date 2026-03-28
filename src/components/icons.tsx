import { cn } from "@/lib/utils";

/**
 * Unread indicator dot — consistent across toolbar, list items, and footer.
 * Renders a filled blue circle when unread, an empty circle outline when read.
 */
export function UnreadIcon({ unread, className }: { unread: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full",
        unread ? "bg-blue-400" : "border-2 border-current",
        className,
      )}
      aria-hidden="true"
    />
  );
}
