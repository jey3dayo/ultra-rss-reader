import type { ArticleDto } from "@/api/tauri-commands";
import { ArticleContextMenu } from "./article-context-menu";
import { ArticleListItem } from "./article-list-item";

export type ArticleGroupsViewItem = {
  article: ArticleDto;
  feedName: string | undefined;
  isSelected: boolean;
  isRecentlyRead: boolean;
};

export type ArticleGroupsViewGroup = {
  id: string;
  label: string;
  showLabel: boolean;
  items: ArticleGroupsViewItem[];
};

export type ArticleGroupsViewProps = {
  groups: ArticleGroupsViewGroup[];
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  onSelectArticle: (articleId: string) => void;
};

export function ArticleGroupsView({
  groups,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  onSelectArticle,
}: ArticleGroupsViewProps) {
  return groups.map((group) => (
    <div key={group.id}>
      {group.showLabel && (
        <div className="sticky top-0 bg-card px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.label}</span>
        </div>
      )}

      {group.items.map((item) => (
        <ArticleContextMenu key={item.article.id} article={item.article}>
          <ArticleListItem
            article={item.article}
            isSelected={item.isSelected}
            isRecentlyRead={item.isRecentlyRead}
            dimArchived={dimArchived}
            textPreview={textPreview}
            imagePreviews={imagePreviews}
            selectionStyle={selectionStyle}
            feedName={item.feedName}
            onSelect={() => onSelectArticle(item.article.id)}
          />
        </ArticleContextMenu>
      ))}
    </div>
  ));
}
