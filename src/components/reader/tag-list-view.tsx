import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TagListItemViewModel = {
  id: string;
  name: string;
  color: string | null;
  articleCount: number;
  isSelected: boolean;
};

export type TagListViewProps = {
  tagsLabel: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  tags: TagListItemViewModel[];
  onSelectTag: (tagId: string) => void;
  renderContextMenu?: (tag: TagListItemViewModel) => ReactNode;
};

export function TagListView({
  tagsLabel,
  isOpen,
  onToggleOpen,
  tags,
  onSelectTag,
  renderContextMenu,
}: TagListViewProps) {
  if (tags.length === 0) return null;

  return (
    <div>
      <div className="px-2 py-2">
        <button type="button" onClick={onToggleOpen} className="flex w-full items-center justify-between px-2 py-1">
          <span className="text-sm font-medium text-sidebar-foreground">{tagsLabel}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
        </button>
      </div>
      {isOpen && (
        <div className="space-y-0.5 px-2">
          {tags.map((tag) => (
            <ContextMenu.Root key={tag.id}>
              <ContextMenu.Trigger
                render={
                  <button
                    type="button"
                    onClick={() => onSelectTag(tag.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
                      tag.isSelected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    )}
                  />
                }
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {tag.color && (
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    )}
                  </span>
                  <span className="truncate">{tag.name}</span>
                </div>
                {tag.articleCount > 0 && (
                  <span className="ml-2 shrink-0 text-muted-foreground">{tag.articleCount.toLocaleString()}</span>
                )}
              </ContextMenu.Trigger>
              {renderContextMenu?.(tag)}
            </ContextMenu.Root>
          ))}
        </div>
      )}
    </div>
  );
}
