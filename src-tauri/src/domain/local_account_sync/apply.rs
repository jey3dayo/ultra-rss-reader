use super::*;

pub(super) fn apply_operation(
    projection: &mut LocalAccountSyncProjection,
    operation: &LocalAccountSyncOperation,
) -> Result<(), String> {
    match (&operation.entity_key, &operation.action) {
        (
            LocalSyncEntityKey::Feed {
                normalized_feed_url,
            },
            LocalSyncAction::UpsertFeed {
                title,
                site_url,
                icon_url,
                folder_name,
            },
        ) => {
            let should_apply = projection
                .feeds
                .get(normalized_feed_url)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.feeds.insert(
                    normalized_feed_url.clone(),
                    LocalSyncFeedState {
                        title: title.trim().to_string(),
                        site_url: site_url.trim().to_string(),
                        icon_url: icon_url.as_ref().map(|url| url.trim().to_string()),
                        folder_name: folder_name.as_ref().map(|name| name.trim().to_string()),
                        updated_at: operation.occurred_at,
                    },
                );
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::Folder { normalized_name },
            LocalSyncAction::UpsertFolder {
                display_name,
                sort_order,
            },
        ) => {
            let should_apply = projection
                .folders
                .get(normalized_name)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.folders.insert(
                    normalized_name.clone(),
                    LocalSyncFolderState {
                        display_name: display_name.trim().to_string(),
                        sort_order: *sort_order,
                        updated_at: operation.occurred_at,
                    },
                );
            }
            Ok(())
        }
        (LocalSyncEntityKey::Article { article_key }, LocalSyncAction::SetRead { is_read }) => {
            let state = projection.articles.entry(article_key.clone()).or_default();
            if state
                .read_updated_at
                .is_none_or(|current| operation.occurred_at >= current)
            {
                state.is_read = Some(*is_read);
                state.read_updated_at = Some(operation.occurred_at);
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::Article { article_key },
            LocalSyncAction::SetStarred { is_starred },
        ) => {
            let state = projection.articles.entry(article_key.clone()).or_default();
            if state
                .starred_updated_at
                .is_none_or(|current| operation.occurred_at >= current)
            {
                state.is_starred = Some(*is_starred);
                state.starred_updated_at = Some(operation.occurred_at);
            }
            Ok(())
        }
        (LocalSyncEntityKey::Tag { normalized_name }, LocalSyncAction::AddTag { display_name }) => {
            let should_apply = projection
                .tags
                .get(normalized_name)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.tags.insert(
                    normalized_name.clone(),
                    LocalSyncTagState {
                        display_name: display_name.trim().to_string(),
                        updated_at: operation.occurred_at,
                        removed_at: None,
                    },
                );
            }
            Ok(())
        }
        (LocalSyncEntityKey::Tag { normalized_name }, LocalSyncAction::RemoveTag) => {
            let should_apply = projection
                .tags
                .get(normalized_name)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.tags.insert(
                    normalized_name.clone(),
                    LocalSyncTagState {
                        display_name: normalized_name.clone(),
                        updated_at: operation.occurred_at,
                        removed_at: Some(operation.occurred_at),
                    },
                );
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::ArticleTag {
                article_key,
                normalized_tag_name,
            },
            LocalSyncAction::AddArticleTag,
        ) => {
            let key = (article_key.clone(), normalized_tag_name.clone());
            let tombstone_is_newer = projection
                .article_tag_tombstones
                .get(&key)
                .is_some_and(|removed_at| *removed_at > operation.occurred_at);
            if !tombstone_is_newer {
                projection.article_tags.insert(key);
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::ArticleTag {
                article_key,
                normalized_tag_name,
            },
            LocalSyncAction::RemoveArticleTag,
        ) => {
            let key = (article_key.clone(), normalized_tag_name.clone());
            projection.article_tags.remove(&key);
            projection
                .article_tag_tombstones
                .insert(key, operation.occurred_at);
            Ok(())
        }
        (
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword,
                scope,
            },
            LocalSyncAction::UpsertMuteKeyword,
        ) => {
            let key = (normalized_keyword.clone(), scope.trim().to_string());
            let tombstone_is_newer = projection
                .mute_keyword_tombstones
                .get(&key)
                .is_some_and(|removed_at| *removed_at > operation.occurred_at);
            let should_apply = !tombstone_is_newer
                && projection
                    .mute_keywords
                    .get(&key)
                    .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.mute_keywords.insert(
                    key,
                    LocalSyncMuteKeywordState {
                        keyword: normalized_keyword.clone(),
                        scope: scope.trim().to_string(),
                        updated_at: operation.occurred_at,
                    },
                );
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword,
                scope,
            },
            LocalSyncAction::RemoveMuteKeyword,
        ) => {
            let key = (normalized_keyword.clone(), scope.trim().to_string());
            projection.mute_keywords.remove(&key);
            projection
                .mute_keyword_tombstones
                .insert(key, operation.occurred_at);
            Ok(())
        }
        (entity_key, LocalSyncAction::ReportFeedFolderConflict { reason }) => {
            projection
                .feed_folder_conflicts
                .push(LocalSyncFeedFolderConflict {
                    entity_key: entity_key.clone(),
                    reason: reason.trim().to_string(),
                    occurred_at: operation.occurred_at,
                    operation_id: operation.operation_id.clone(),
                });
            Ok(())
        }
        _ => Err("Local sync operation action does not match entity key".to_string()),
    }
}
