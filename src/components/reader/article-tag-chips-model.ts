import { normalizeTagColorForView } from "@/api/schemas/commands";
import type { TagViewItem } from "@/lib/tags.types";
import type { ArticleTagPickerTagView } from "./article-tag-picker-view";

function toArticleTagPickerTagView(tag: TagViewItem): ArticleTagPickerTagView {
  return {
    id: tag.id,
    name: tag.name,
    color: normalizeTagColorForView(tag.color),
  };
}

function normalizeArticleTagNameForMatch(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function findArticleTagByName(tags: Array<TagViewItem> | undefined, name: string): TagViewItem | null {
  const normalizedName = normalizeArticleTagNameForMatch(name);
  if (!normalizedName) {
    return null;
  }

  return tags?.find((tag) => normalizeArticleTagNameForMatch(tag.name) === normalizedName) ?? null;
}

function toUniqueTagViewsById(
  tags: Array<TagViewItem>,
  isIncluded: (tag: TagViewItem) => boolean,
): ArticleTagPickerTagView[] {
  const seenIds = new Set<string>();
  const views: ArticleTagPickerTagView[] = [];
  for (const tag of tags) {
    if (!tag.id || seenIds.has(tag.id) || !isIncluded(tag)) {
      continue;
    }
    seenIds.add(tag.id);
    views.push(toArticleTagPickerTagView(tag));
  }
  return views;
}

export function buildArticleTagPickerLists(params: {
  articleTags: Array<TagViewItem> | undefined;
  allTags: Array<TagViewItem> | undefined;
}): {
  assignedTags: ArticleTagPickerTagView[];
  availableTags: ArticleTagPickerTagView[];
} {
  const { articleTags = [], allTags } = params;
  const activeTagIds = allTags ? new Set(allTags.map((tag) => tag.id)) : null;
  const assignedTags = toUniqueTagViewsById(articleTags, (tag) => !activeTagIds || activeTagIds.has(tag.id));
  const assignedTagIds = new Set(assignedTags.map((tag) => tag.id));
  const availableTags = toUniqueTagViewsById(allTags ?? [], (tag) => !assignedTagIds.has(tag.id));

  return { assignedTags, availableTags };
}
