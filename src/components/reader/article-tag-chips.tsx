import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { normalizeTagColorForView } from "@/api/schemas/commands";
import { useArticleTags, useCreateTag, useTagArticle, useTags, useUntagArticle } from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleTagPickerTagView } from "./article-tag-picker.types";
import { ArticleTagPickerView } from "./article-tag-picker-view";

type ArticleTagChipsProps = {
  articleId: string;
};

type ArticleTagChipsState = {
  showPicker: boolean;
  newTagName: string;
};

type ArticleTagChipsAction =
  | { type: "set-show-picker"; value: boolean }
  | { type: "set-new-tag-name"; value: string }
  | { type: "finish-create-tag" };

const initialArticleTagChipsState: ArticleTagChipsState = {
  showPicker: false,
  newTagName: "",
};

function articleTagChipsReducer(state: ArticleTagChipsState, action: ArticleTagChipsAction): ArticleTagChipsState {
  switch (action.type) {
    case "set-show-picker":
      return { ...state, showPicker: action.value };
    case "set-new-tag-name":
      return { ...state, newTagName: action.value };
    case "finish-create-tag":
      return { showPicker: false, newTagName: "" };
    default:
      return state;
  }
}

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

function toArticleTagAssignErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
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
  const activeTagIds = allTags ? new Set(allTags.map((tag) => tag.id).filter((tagId) => tagId.length > 0)) : null;
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

export function ArticleTagChips({ articleId }: ArticleTagChipsProps) {
  const { t } = useTranslation("reader");
  const { data: articleTags } = useArticleTags(articleId);
  const { data: allTags } = useTags();
  const tagArticleMutation = useTagArticle();
  const untagArticleMutation = useUntagArticle();
  const createTagMutation = useCreateTag();
  const showToast = useUiStore((store) => store.showToast);
  const [state, dispatch] = useReducer(articleTagChipsReducer, initialArticleTagChipsState);
  const { showPicker, newTagName } = state;
  const { assignedTags, availableTags } = buildArticleTagPickerLists({
    articleTags,
    allTags,
  });

  const assignExistingTag = (tagId: string) => {
    tagArticleMutation.mutate(
      { articleId, tagId },
      {
        onSuccess: () => {
          dispatch({ type: "finish-create-tag" });
        },
        onError: (error) => {
          showToast(toArticleTagAssignErrorMessage(error));
        },
      },
    );
  };

  const handleCreateAndAssign = (name: string) => {
    if (!name) return;
    const existingTag = findArticleTagByName(allTags, name);
    if (existingTag) {
      if (articleTags?.some((tag) => tag.id === existingTag.id)) {
        dispatch({ type: "finish-create-tag" });
        return;
      }

      assignExistingTag(existingTag.id);
      return;
    }

    createTagMutation.mutate(
      { name },
      {
        onSuccess: (tag) => {
          assignExistingTag(tag.id);
        },
        onError: (error) => {
          showToast(toArticleTagAssignErrorMessage(error));
        },
      },
    );
  };

  return (
    <ArticleTagPickerView
      assignedTags={assignedTags}
      availableTags={availableTags}
      newTagName={newTagName}
      isExpanded={showPicker}
      isCreateTagPending={createTagMutation.isPending}
      labels={{
        sectionTitle: t("tags_section_title"),
        sectionHint: t("tags_section_hint"),
        addTag: t("add_tag"),
        availableTags: t("available_tags"),
        newTagPlaceholder: t("new_tag_placeholder"),
        createTag: t("create_tag"),
        removeTag: (name) => t("remove_tag", { name }),
      }}
      onExpandedChange={(value) => dispatch({ type: "set-show-picker", value })}
      onNewTagNameChange={(value) => dispatch({ type: "set-new-tag-name", value })}
      onAssignTag={assignExistingTag}
      onRemoveTag={(tagId) => {
        untagArticleMutation.mutate({ articleId, tagId });
      }}
      onCreateTag={handleCreateAndAssign}
    />
  );
}
