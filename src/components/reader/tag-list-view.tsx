import { ContextMenu } from "@base-ui/react/context-menu";
import { SidebarSectionToggle } from "@/components/shared/sidebar-section-toggle";
import { SidebarNavButton } from "./sidebar-nav-button";
import type { SidebarTagItem, SidebarTagListProps } from "./sidebar-tag-items.types";

export type TagListItemViewModel = SidebarTagItem;

export function TagListView({
  tagsLabel,
  isOpen,
  onToggleOpen,
  tags,
  onSelectTag,
  renderContextMenu,
}: SidebarTagListProps) {
  if (tags.length === 0) return null;

  return (
    <div>
      <div className="px-2 py-2">
        <SidebarSectionToggle label={tagsLabel} isOpen={isOpen} onToggle={onToggleOpen} />
      </div>
      {isOpen && (
        <div className="space-y-1 px-2">
          {tags.map((tag) => (
            <ContextMenu.Root key={tag.id}>
              <ContextMenu.Trigger
                render={
                  <SidebarNavButton
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
      )}
    </div>
  );
}
