import { ContextMenu } from "@base-ui/react/context-menu";
import { SidebarSectionToggle } from "@/components/shared/sidebar-section-toggle";
import { cn } from "@/lib/utils";
import { getSidebarDensityTokens } from "./sidebar-density";
import { SidebarNavButton } from "./sidebar-nav-button";
import type { SidebarTagItem, SidebarTagListProps } from "./sidebar-tag-items.types";

export type TagListItemViewModel = SidebarTagItem;

export function TagListView({
  tagsLabel,
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

  return (
    <div>
      <div className="px-2 py-2">
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
        aria-hidden={isOpen ? "false" : "true"}
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          isOpen && tags.length > 0 ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div
          className={cn(
            "min-h-0 overflow-hidden transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            isOpen && tags.length > 0 ? "translate-y-0" : "-translate-y-2",
          )}
        >
          <div className={cn("px-2", tokens.tagListGap)}>
            {tags.map((tag) => (
              <ContextMenu.Root key={tag.id}>
                <ContextMenu.Trigger
                  render={
                    <SidebarNavButton
                      density={sidebarDensity}
                      onClick={() => onSelectTag(tag.id)}
                      selected={tag.isSelected}
                      trailing={tag.articleCount > 0 ? tag.articleCount.toLocaleString() : undefined}
                      className={!tag.isSelected ? "text-sidebar-foreground" : undefined}
                    />
                  }
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {tag.color && (
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    )}
                  </span>
                  <span className="truncate">{tag.name}</span>
                </ContextMenu.Trigger>
                {renderContextMenu?.(tag)}
              </ContextMenu.Root>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
