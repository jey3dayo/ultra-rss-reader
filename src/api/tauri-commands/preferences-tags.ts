import {
  ArticleDtoListSchema,
  type ArticleListMode,
  createTagArgs,
  deleteTagArgs,
  getArticleTagsArgs,
  getTagArticleCountsArgs,
  listArticlesByTagArgs,
  NullResponseSchema,
  PreferencesDtoSchema,
  renameTagArgs,
  setPreferenceArgs,
  TagArticleCountsSchema,
  TagDtoListSchema,
  TagDtoSchema,
  tagArticleArgs,
  untagArticleArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const getPreferences = () => safeInvoke("get_preferences", { response: PreferencesDtoSchema });

export const setPreference = (key: string, value: string) =>
  safeInvoke("set_preference", { response: NullResponseSchema, args: setPreferenceArgs }, { key, value });

// Tags
export const listTags = () => safeInvoke("list_tags", { response: TagDtoListSchema });

export const createTag = (name: string, color?: string) =>
  safeInvoke("create_tag", { response: TagDtoSchema, args: createTagArgs }, { name, color });

export const renameTag = (tagId: string, name: string, color?: string | null) =>
  safeInvoke("rename_tag", { response: TagDtoSchema, args: renameTagArgs }, { tagId, name, color });

export const deleteTag = (tagId: string) =>
  safeInvoke("delete_tag", { response: NullResponseSchema, args: deleteTagArgs }, { tagId });

export const tagArticle = (articleId: string, tagId: string) =>
  safeInvoke("tag_article", { response: NullResponseSchema, args: tagArticleArgs }, { articleId, tagId });

export const untagArticle = (articleId: string, tagId: string) =>
  safeInvoke("untag_article", { response: NullResponseSchema, args: untagArticleArgs }, { articleId, tagId });

export const getArticleTags = (articleId: string) =>
  safeInvoke("get_article_tags", { response: TagDtoListSchema, args: getArticleTagsArgs }, { articleId });

export const listArticlesByTag = (
  tagId: string,
  offset?: number,
  limit?: number,
  accountId?: string,
  mode?: ArticleListMode,
) =>
  safeInvoke(
    "list_articles_by_tag",
    { response: ArticleDtoListSchema, args: listArticlesByTagArgs },
    { tagId, offset, limit, accountId, mode },
  );

export const getTagArticleCounts = (accountId?: string) =>
  safeInvoke(
    "get_tag_article_counts",
    {
      response: TagArticleCountsSchema,
      args: getTagArticleCountsArgs,
    },
    { accountId },
  );
