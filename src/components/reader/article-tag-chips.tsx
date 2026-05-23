import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useArticleTags, useCreateTag, useTagArticle, useTags, useUntagArticle } from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";
import { buildArticleTagPickerLists, findArticleTagByName } from "./article-tag-chips-model";
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

function toArticleTagAssignErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
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
          showToast(t("article_tag_added_recovery"));
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
        untagArticleMutation.mutate(
          { articleId, tagId },
          {
            onSuccess: () => {
              showToast(t("article_tag_removed_recovery"));
            },
            onError: (error) => {
              showToast(toArticleTagAssignErrorMessage(error));
            },
          },
        );
      }}
      onCreateTag={handleCreateAndAssign}
    />
  );
}
