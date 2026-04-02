import type { ReactNode } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
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
  renderRow?: (params: { article: ArticleDto; articleId: string; content: ReactNode }) => ReactNode;
};

export function ArticleGroupsView({
  groups,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  onSelectArticle,
  renderRow,
}: ArticleGroupsViewProps) {
  return groups.map((group) => (
    <div key={group.id}>
      {group.showLabel && (
        <div data-group-header="true" className="sticky top-0 bg-card px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.label}</span>
        </div>
      )}

      {group.items.map((item) => (
        <div key={item.article.id}>
          {(renderRow ?? (({ content }) => content))({
            article: item.article,
            articleId: item.article.id,
            content: (
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
            ),
          })}
        </div>
      ))}
    </div>
  ));
}
