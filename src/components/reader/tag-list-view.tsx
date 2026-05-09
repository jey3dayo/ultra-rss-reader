import { ContextMenu } from "@base-ui/react/context-menu";
import { SidebarSectionToggle } from "@/components/shared/sidebar-section-toggle";
import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { getSidebarDensityTokens } from "./sidebar-density";
import { SidebarNavButton } from "./sidebar-nav-button";
import type { SidebarTagListProps } from "./sidebar-tag-items.types";

export function TagListView({
  tagsLabel,
  emptyLabel,
  isOpen,
  onToggleOpen,
  sidebarDensity = "normal",
  tags,
  onSelectTag,
  renderContextMenu,
  renderTagSectionContextMenu,
}: SidebarTagListProps) {
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const panelId = "sidebar-tag-section-panel";
  const isEmpty = tags.length === 0;

  return (
    <div>
      <div className="p-2">
        <SidebarSectionToggle
          label={tagsLabel}
          isOpen={isOpen}
          onToggle={onToggleOpen}
          panelId={panelId}
          contextMenu={renderTagSectionContextMenu?.()}
        />
      </div>
      <div
        id={panelId}
        data-state={isOpen ? "open" : "closed"}
        data-empty={isEmpty ? "true" : "false"}
        aria-hidden={isOpen ? "false" : "true"}
        className="motion-disclosure-panel"
      >
        <div className="motion-disclosure-body">
          <div className={cn("px-2", tokens.tagListGap)}>
            {isEmpty ? (
              emptyLabel ? (
                <p className="px-2 py-1.5 text-sm text-sidebar-foreground/65">{emptyLabel}</p>
              ) : null
            ) : (
              tags.map((tag) => (
                <ContextMenu.Root key={tag.id}>
                  <ContextMenu.Trigger
                    render={
                      <SidebarNavButton
                        density={sidebarDensity}
                        onClick={() => onSelectTag(tag.id)}
                        selected={tag.isSelected}
                        {...(tag.isSelected ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                        trailing={tag.articleCount > 0 ? tag.articleCount.toLocaleString() : undefined}
                        className={!tag.isSelected ? "text-sidebar-foreground" : undefined}
                      />
                    }
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      {tag.color && (
                        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      )}
                    </span>
                    <span className="truncate">{tag.name}</span>
                  </ContextMenu.Trigger>
                  {renderContextMenu?.(tag)}
                </ContextMenu.Root>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
