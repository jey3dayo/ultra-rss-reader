use super::*;

fn ts(seconds: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(seconds, 0).expect("test timestamp should be valid")
}

fn op(
    id: &str,
    occurred_at: DateTime<Utc>,
    entity_key: LocalSyncEntityKey,
    action: LocalSyncAction,
) -> LocalAccountSyncOperation {
    LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("device-a".to_string()),
        operation_id: LocalSyncOperationId(id.to_string()),
        occurred_at,
        entity_key,
        action,
    }
}

fn article_key() -> LocalSyncArticleKey {
    LocalSyncArticleKey("article-a".to_string())
}

#[test]
fn sync_article_key_uses_sync_account_and_normalized_feed_url() {
    let sync_account = LocalSyncAccountId("sync-account-a".to_string());
    let key = generate_local_sync_article_key(
        &sync_account,
        " https://example.com/feed.xml#fragment ",
        LocalSyncEntryIdentity {
            guid: Some(" guid-1 ".to_string()),
            url: Some("https://example.com/ignored".to_string()),
            title: Some("Ignored".to_string()),
        },
    )
    .expect("sync article key should be generated");
    let same_key = generate_local_sync_article_key(
        &sync_account,
        "https://example.com/feed.xml",
        LocalSyncEntryIdentity {
            guid: Some("guid-1".to_string()),
            url: None,
            title: None,
        },
    )
    .expect("sync article key should normalize same feed URL");

    assert_eq!(key.identity_kind, LocalSyncEntryIdentityKind::Guid);
    assert_eq!(key.key, same_key.key);
    assert_eq!(key.key.0.len(), 64);
}

#[test]
fn sync_article_key_falls_back_from_guid_to_url_to_title() {
    let sync_account = LocalSyncAccountId("sync-account-a".to_string());
    let url_key = generate_local_sync_article_key(
        &sync_account,
        "https://example.com/feed.xml",
        LocalSyncEntryIdentity {
            guid: Some("  ".to_string()),
            url: Some("https://example.com/post".to_string()),
            title: Some("Title".to_string()),
        },
    )
    .expect("url fallback should generate key");
    let title_key = generate_local_sync_article_key(
        &sync_account,
        "https://example.com/feed.xml",
        LocalSyncEntryIdentity {
            guid: None,
            url: None,
            title: Some("Title".to_string()),
        },
    )
    .expect("title fallback should generate key");

    assert_eq!(url_key.identity_kind, LocalSyncEntryIdentityKind::Url);
    assert_eq!(title_key.identity_kind, LocalSyncEntryIdentityKind::Title);
    assert_ne!(url_key.key, title_key.key);
}

#[test]
fn read_and_star_merge_uses_latest_operation_per_field() {
    let key = article_key();
    let result = merge_local_account_sync_operations([
        op(
            "read-new",
            ts(30),
            LocalSyncEntityKey::Article {
                article_key: key.clone(),
            },
            LocalSyncAction::SetRead { is_read: true },
        ),
        op(
            "read-old",
            ts(10),
            LocalSyncEntityKey::Article {
                article_key: key.clone(),
            },
            LocalSyncAction::SetRead { is_read: false },
        ),
        op(
            "star",
            ts(20),
            LocalSyncEntityKey::Article {
                article_key: key.clone(),
            },
            LocalSyncAction::SetStarred { is_starred: true },
        ),
    ]);

    let article = result
        .projection
        .articles
        .get(&key)
        .expect("merged article should exist");
    assert_eq!(article.is_read, Some(true));
    assert_eq!(article.is_starred, Some(true));
    assert_eq!(result.applied_operations, 3);
    assert!(result.rejected_operations.is_empty());
}

#[test]
fn feed_and_folder_merge_uses_latest_operations_without_db_ids() {
    let feed_url =
        normalize_feed_url("https://example.com/feed.xml").expect("feed URL should normalize");
    let folder_name = normalize_tag_name(" Tech ").expect("folder name should normalize");
    let result = merge_local_account_sync_operations([
        op(
            "folder-old",
            ts(10),
            LocalSyncEntityKey::Folder {
                normalized_name: folder_name.clone(),
            },
            LocalSyncAction::UpsertFolder {
                display_name: "Tech".to_string(),
                sort_order: 0,
            },
        ),
        op(
            "folder-new",
            ts(20),
            LocalSyncEntityKey::Folder {
                normalized_name: folder_name.clone(),
            },
            LocalSyncAction::UpsertFolder {
                display_name: "Engineering".to_string(),
                sort_order: 1,
            },
        ),
        op(
            "feed-old",
            ts(10),
            LocalSyncEntityKey::Feed {
                normalized_feed_url: feed_url.clone(),
            },
            LocalSyncAction::UpsertFeed {
                title: "Old".to_string(),
                site_url: "https://example.com".to_string(),
                icon_url: Some("https://example.com/old-icon.png".to_string()),
                folder_name: Some("Tech".to_string()),
            },
        ),
        op(
            "feed-new",
            ts(20),
            LocalSyncEntityKey::Feed {
                normalized_feed_url: feed_url.clone(),
            },
            LocalSyncAction::UpsertFeed {
                title: "New".to_string(),
                site_url: "https://example.com/blog".to_string(),
                icon_url: Some("https://example.com/new-icon.png".to_string()),
                folder_name: None,
            },
        ),
    ]);

    let folder = result
        .projection
        .folders
        .get(&folder_name)
        .expect("folder should merge by normalized name");
    assert_eq!(folder.display_name, "Engineering");
    assert_eq!(folder.sort_order, 1);
    let feed = result
        .projection
        .feeds
        .get(&feed_url)
        .expect("feed should merge by normalized feed URL");
    assert_eq!(feed.title, "New");
    assert_eq!(
        feed.icon_url.as_deref(),
        Some("https://example.com/new-icon.png")
    );
    assert_eq!(feed.folder_name, None);
}

#[test]
fn tag_and_article_tag_merge_preserves_remove_tombstones() {
    let key = article_key();
    let tag = normalize_tag_name(" Tech ").expect("tag name should normalize");
    let result = merge_local_account_sync_operations([
        op(
            "tag-add",
            ts(10),
            LocalSyncEntityKey::Tag {
                normalized_name: tag.clone(),
            },
            LocalSyncAction::AddTag {
                display_name: "Tech".to_string(),
            },
        ),
        op(
            "article-tag-add",
            ts(20),
            LocalSyncEntityKey::ArticleTag {
                article_key: key.clone(),
                normalized_tag_name: tag.clone(),
            },
            LocalSyncAction::AddArticleTag,
        ),
        op(
            "article-tag-remove",
            ts(30),
            LocalSyncEntityKey::ArticleTag {
                article_key: key.clone(),
                normalized_tag_name: tag.clone(),
            },
            LocalSyncAction::RemoveArticleTag,
        ),
        op(
            "article-tag-stale-add",
            ts(25),
            LocalSyncEntityKey::ArticleTag {
                article_key: key.clone(),
                normalized_tag_name: tag.clone(),
            },
            LocalSyncAction::AddArticleTag,
        ),
    ]);

    assert!(result.projection.tags.contains_key(&tag));
    assert!(!result
        .projection
        .article_tags
        .contains(&(key.clone(), tag.clone())));
    assert_eq!(
        result
            .projection
            .article_tag_tombstones
            .get(&(key, tag))
            .copied(),
        Some(ts(30))
    );
}

#[test]
fn mute_keyword_merge_preserves_remove_tombstones() {
    let keyword = normalize_mute_keyword(" Kindle ").expect("keyword should normalize");
    let scope = "title".to_string();
    let result = merge_local_account_sync_operations([
        op(
            "mute-add",
            ts(10),
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: keyword.clone(),
                scope: scope.clone(),
            },
            LocalSyncAction::UpsertMuteKeyword,
        ),
        op(
            "mute-remove",
            ts(20),
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: keyword.clone(),
                scope: scope.clone(),
            },
            LocalSyncAction::RemoveMuteKeyword,
        ),
        op(
            "mute-stale-add",
            ts(15),
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: keyword.clone(),
                scope: scope.clone(),
            },
            LocalSyncAction::UpsertMuteKeyword,
        ),
    ]);

    let key = (keyword, scope);
    assert!(!result.projection.mute_keywords.contains_key(&key));
    assert_eq!(
        result.projection.mute_keyword_tombstones.get(&key).copied(),
        Some(ts(20))
    );
}

#[test]
fn feed_folder_conflicts_are_kept_in_projection() {
    let feed_url =
        normalize_feed_url("https://example.com/feed.xml").expect("feed URL should normalize");
    let result = merge_local_account_sync_operations([op(
        "conflict",
        ts(10),
        LocalSyncEntityKey::Feed {
            normalized_feed_url: feed_url.clone(),
        },
        LocalSyncAction::ReportFeedFolderConflict {
            reason: "feed moved while folder was removed".to_string(),
        },
    )]);

    assert_eq!(result.projection.feed_folder_conflicts.len(), 1);
    assert_eq!(
        result.projection.feed_folder_conflicts[0].entity_key,
        LocalSyncEntityKey::Feed {
            normalized_feed_url: feed_url,
        }
    );
}

#[test]
fn parse_operation_rejects_schema_mismatch_before_merge() {
    let operation = op(
        "op-1",
        ts(10),
        LocalSyncEntityKey::Article {
            article_key: article_key(),
        },
        LocalSyncAction::SetRead { is_read: true },
    );
    let mut file = operation_file(operation);
    file.version = LOCAL_ACCOUNT_SYNC_SCHEMA_VERSION + 1;
    let content =
        serde_json::to_string(&file).expect("test operation file should serialize to JSON");

    let error = parse_operation_file(&content)
        .expect_err("schema mismatch should reject operation before merge");
    assert!(error
        .to_string()
        .contains("Unsupported local sync operation version"));
}

#[test]
fn parse_operation_defaults_missing_feed_icon_url_to_none() {
    let operation = op(
        "feed-op",
        ts(10),
        LocalSyncEntityKey::Feed {
            normalized_feed_url: "https://example.com/feed.xml".to_string(),
        },
        LocalSyncAction::UpsertFeed {
            title: "Feed".to_string(),
            site_url: "https://example.com".to_string(),
            icon_url: Some("https://example.com/icon.png".to_string()),
            folder_name: None,
        },
    );
    let mut value = serde_json::to_value(operation_file(operation))
        .expect("test operation file should serialize to JSON");
    value["operation"]["action"]
        .as_object_mut()
        .expect("feed action should serialize as an object")
        .remove("icon_url");

    let parsed = parse_operation_file(
        &serde_json::to_string(&value).expect("legacy operation should serialize to JSON"),
    )
    .expect("legacy operation without icon_url should parse");

    let LocalSyncAction::UpsertFeed { icon_url, .. } = parsed.operation.action else {
        panic!("expected feed upsert action");
    };
    assert_eq!(icon_url, None);
}
