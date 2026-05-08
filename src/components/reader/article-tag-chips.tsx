import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useArticleTags, useCreateTag, useTagArticle, useTags, useUntagArticle } from "@/hooks/use-tags";
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
    color: tag.color,
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
  const assignedTagIds = new Set(articleTags?.map((tag) => tag.id) ?? []);

  return {
    assignedTags: (articleTags ?? []).map(toArticleTagPickerTagView),
    availableTags: (allTags ?? []).filter((tag) => !assignedTagIds.has(tag.id)).map(toArticleTagPickerTagView),
  };
}

export function ArticleTagChips({ articleId }: ArticleTagChipsProps) {
  const { t } = useTranslation("reader");
  const { data: articleTags } = useArticleTags(articleId);
  const { data: allTags } = useTags();
  const tagArticleMutation = useTagArticle();
  const untagArticleMutation = useUntagArticle();
  const createTagMutation = useCreateTag();
  const [state, dispatch] = useReducer(articleTagChipsReducer, initialArticleTagChipsState);
  const { showPicker, newTagName } = state;
  const { assignedTags, availableTags } = buildArticleTagPickerLists({
    articleTags,
    allTags,
  });

  const handleCreateAndAssign = (name: string) => {
    if (!name) return;
    const existingTag = findArticleTagByName(allTags, name);
    if (existingTag) {
      if (articleTags?.some((tag) => tag.id === existingTag.id)) {
        dispatch({ type: "finish-create-tag" });
        return;
      }

      tagArticleMutation.mutate(
        { articleId, tagId: existingTag.id },
        {
          onSuccess: () => {
            dispatch({ type: "finish-create-tag" });
          },
        },
      );
      return;
    }

    createTagMutation.mutate(
      { name },
      {
        onSuccess: (tag) => {
          tagArticleMutation.mutate({ articleId, tagId: tag.id });
          dispatch({ type: "finish-create-tag" });
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
      onAssignTag={(tagId) => {
        tagArticleMutation.mutate({ articleId, tagId });
      }}
      onRemoveTag={(tagId) => {
        untagArticleMutation.mutate({ articleId, tagId });
      }}
      onCreateTag={handleCreateAndAssign}
    />
  );
}
