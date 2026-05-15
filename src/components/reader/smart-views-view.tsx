import { ContextMenu } from "@base-ui/react/context-menu";
import type { ReactNode } from "react";
import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE, SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE } from "@/lib/reader-focus";
import type { SmartViewItemViewModel } from "@/lib/sidebar/sidebar-smart-views";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import { cn } from "@/lib/utils";
import { SidebarNavButton } from "./sidebar-nav-button";

export type SidebarSmartViewsProps = {
  title?: string;
  views: SmartViewItemViewModel[];
  onSelectSmartView: (kind: SmartViewKind) => void;
  renderContextMenu?: (view: SmartViewItemViewModel) => ReactNode;
};

type SmartViewToneClassNames = {
  selected: string;
  hover: string;
  trailing: string;
};

const SMART_VIEW_TONE_CLASSNAMES: Record<SmartViewKind, SmartViewToneClassNames> = {
  unread: {
    selected: "bg-[var(--semantic-tone-unread-surface)] text-[var(--semantic-tone-unread-sidebar-foreground)]",
    hover: "hover:text-[var(--semantic-tone-unread-sidebar-foreground)]",
    trailing: "text-[var(--semantic-tone-unread-sidebar-foreground)] opacity-80",
  },
  starred: {
    selected: "bg-[var(--semantic-tone-starred-surface)] text-[var(--semantic-tone-starred-sidebar-foreground)]",
    hover: "hover:text-[var(--semantic-tone-starred-sidebar-foreground)]",
    trailing: "text-[var(--semantic-tone-starred-sidebar-foreground)] opacity-80",
  },
  recent: {
    selected: "bg-surface-2 text-foreground",
    hover: "hover:text-foreground",
    trailing: "text-foreground-soft opacity-80",
  },
};

export function SmartViewsView({ title, views, onSelectSmartView, renderContextMenu }: SidebarSmartViewsProps) {
  return (
    <div className="space-y-2.5 px-3 py-2">
      {title ? (
        <div className="select-none px-2 text-[0.66rem] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
          {title}
        </div>
      ) : null}
      {views.map((view) => (
        <ContextMenu.Root key={view.kind}>
          <ContextMenu.Trigger
            render={
              <SidebarNavButton
                aria-pressed={view.isSelected}
                selected={view.isSelected}
                selectedIndicatorMode="hidden"
                {...{ [SIDEBAR_SMART_VIEW_KIND_ATTRIBUTE]: view.kind }}
                {...(view.isSelected ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                size="default"
                trailing={view.showCount ? view.count.toLocaleString() : undefined}
                className={cn(
                  "rounded-lg shadow-none",
                  SMART_VIEW_TONE_CLASSNAMES[view.kind].hover,
                  view.isSelected && SMART_VIEW_TONE_CLASSNAMES[view.kind].selected,
                )}
                trailingClassName={view.isSelected ? SMART_VIEW_TONE_CLASSNAMES[view.kind].trailing : undefined}
              />
            }
            onClick={() => onSelectSmartView(view.kind)}
          >
            <span className="font-semibold tracking-[-0.01em]">{view.label}</span>
          </ContextMenu.Trigger>
          {renderContextMenu?.(view)}
        </ContextMenu.Root>
      ))}
    </div>
  );
}
