import { cn } from "@/lib/utils";

export type SmartViewKind = "unread" | "starred";

export type SmartViewItemViewModel = {
  kind: SmartViewKind;
  label: string;
  count: number;
  showCount: boolean;
  isSelected: boolean;
};

export type SmartViewsViewProps = {
  views: SmartViewItemViewModel[];
  onSelectSmartView: (kind: SmartViewKind) => void;
};

export function SmartViewsView({ views, onSelectSmartView }: SmartViewsViewProps) {
  return (
    <div className="space-y-0.5">
      {views.map((view, index) => (
        <button
          key={view.kind}
          type="button"
          onClick={() => onSelectSmartView(view.kind)}
          aria-pressed={view.isSelected}
          className={cn(
            "flex items-center justify-between rounded-md px-2 py-2 text-sm",
            view.isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
            index === 0 ? "mx-2 my-1" : "mx-2 my-0.5",
          )}
        >
          <span className="font-medium">{view.label}</span>
          {view.showCount && <span className="text-muted-foreground">{view.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  );
}
