import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useArticleTags, useCreateTag, useTagArticle, useTags, useUntagArticle } from "@/hooks/use-tags";
import type { ArticleTagChipsProps, ArticleTagPickerTagView } from "./article-tag-picker.types";
import { ArticleTagPickerView } from "./article-tag-picker-view";

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

export function ArticleTagChips({ articleId }: ArticleTagChipsProps) {
  const { t } = useTranslation("reader");
  const { data: articleTags } = useArticleTags(articleId);
  const { data: allTags } = useTags();
  const tagArticleMutation = useTagArticle();
  const untagArticleMutation = useUntagArticle();
  const createTagMutation = useCreateTag();
  const [state, dispatch] = useReducer(articleTagChipsReducer, initialArticleTagChipsState);
  const { showPicker, newTagName } = state;

  const assignedTagIds = new Set(articleTags?.map((tag) => tag.id) ?? []);
  const assignedTags = (articleTags ?? []).map(toArticleTagPickerTagView);
  const unassignedTags = (allTags ?? []).filter((tag) => !assignedTagIds.has(tag.id)).map(toArticleTagPickerTagView);

  const handleCreateAndAssign = (name: string) => {
    if (!name) return;
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
      availableTags={unassignedTags}
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
