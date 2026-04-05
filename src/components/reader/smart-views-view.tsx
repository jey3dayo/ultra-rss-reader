import { SidebarNavButton } from "./sidebar-nav-button";

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
    <div className="space-y-1 px-2 py-1.5">
      {views.map((view) => (
        <SidebarNavButton
          key={view.kind}
          onClick={() => onSelectSmartView(view.kind)}
          aria-pressed={view.isSelected}
          selected={view.isSelected}
          size="default"
          trailing={view.showCount ? view.count.toLocaleString() : undefined}
        >
          <span className="font-medium">{view.label}</span>
        </SidebarNavButton>
      ))}
    </div>
  );
}
