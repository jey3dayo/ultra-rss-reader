import { normalizeTagColorForView } from "@/api/schemas/commands";
import type { ArticleTagPickerTagView } from "./article-tag-picker-view";

function toArticleTagPickerTagView(tag: { id: string; name: string; color: string | null }): ArticleTagPickerTagView {
  return {
    id: tag.id,
    name: tag.name,
    color: normalizeTagColorForView(tag.color),
  };
}

function normalizeArticleTagNameForMatch(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function findArticleTagByName(
  tags: Array<{ id: string; name: string; color: string | null }> | undefined,
  name: string,
): { id: string; name: string; color: string | null } | null {
  const normalizedName = normalizeArticleTagNameForMatch(name);
  if (!normalizedName) {
    return null;
  }

  return tags?.find((tag) => normalizeArticleTagNameForMatch(tag.name) === normalizedName) ?? null;
}

export function buildArticleTagPickerLists(params: {
  articleTags: Array<{ id: string; name: string; color: string | null }> | undefined;
  allTags: Array<{ id: string; name: string; color: string | null }> | undefined;
}): {
  assignedTags: ArticleTagPickerTagView[];
  availableTags: ArticleTagPickerTagView[];
} {
  const { articleTags, allTags } = params;
  const tagsLength = Math.max(articleTags?.length ?? 0, allTags?.length ?? 0);
  const activeTagIds = allTags ? new Set<string>() : null;
  if (activeTagIds) {
    for (const tag of allTags ?? []) {
      if (tag.id.length > 0) {
        activeTagIds.add(tag.id);
      }
    }
  }
  const assignedTagIds = new Set<string>();
  const assignedTags: ArticleTagPickerTagView[] = [];
  const availableTagsById = new Map<string, ArticleTagPickerTagView>();

  for (let index = 0; index < tagsLength; index += 1) {
    const articleTag = articleTags?.[index];
    if (articleTag?.id && activeTagIds?.has(articleTag.id) !== false && !assignedTagIds.has(articleTag.id)) {
      assignedTagIds.add(articleTag.id);
      assignedTags.push(toArticleTagPickerTagView(articleTag));
      availableTagsById.delete(articleTag.id);
    }

    const availableTag = allTags?.[index];
    if (availableTag?.id && !assignedTagIds.has(availableTag.id) && !availableTagsById.has(availableTag.id)) {
      availableTagsById.set(availableTag.id, toArticleTagPickerTagView(availableTag));
    }
  }

  return {
    assignedTags,
    availableTags: Array.from(availableTagsById.values()),
  };
}
