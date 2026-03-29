import { cn } from "@/lib/utils";

type SmartViewKind = "unread" | "starred";

export type SmartViewsViewProps = {
  unreadLabel: string;
  starredLabel: string;
  unreadCount: number;
  starredCount: number;
  showUnreadCount: boolean;
  showStarredCount: boolean;
  selectedKind: SmartViewKind | null;
  onSelectSmartView: (kind: SmartViewKind) => void;
};

function SmartViewButton({
  label,
  count,
  showCount,
  isSelected,
  onClick,
  className,
}: {
  label: string;
  count: number;
  showCount: boolean;
  isSelected: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        "flex items-center justify-between rounded-md px-2 py-2 text-sm",
        isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
        className,
      )}
    >
      <span className="font-medium">{label}</span>
      {showCount && <span className="text-muted-foreground">{count.toLocaleString()}</span>}
    </button>
  );
}

export function SmartViewsView({
  unreadLabel,
  starredLabel,
  unreadCount,
  starredCount,
  showUnreadCount,
  showStarredCount,
  selectedKind,
  onSelectSmartView,
}: SmartViewsViewProps) {
  return (
    <div className="space-y-0.5">
      <SmartViewButton
        label={unreadLabel}
        count={unreadCount}
        showCount={showUnreadCount}
        isSelected={selectedKind === "unread"}
        onClick={() => onSelectSmartView("unread")}
        className="mx-2 my-1"
      />
      <SmartViewButton
        label={starredLabel}
        count={starredCount}
        showCount={showStarredCount && starredCount > 0}
        isSelected={selectedKind === "starred"}
        onClick={() => onSelectSmartView("starred")}
        className="mx-2 my-0.5"
      />
    </div>
  );
}
