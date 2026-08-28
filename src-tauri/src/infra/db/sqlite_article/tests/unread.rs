use super::*;

#[test]
fn recalculate_unread_count_excludes_muted_unread_articles() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let article_repo = SqliteArticleRepository::new(db.writer());
    let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

    let muted = make_article(&feed_id, "Kindle Unlimited offer");
    let visible = make_article(&feed_id, "Visible article");
    article_repo.upsert(&[muted, visible]).unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    assert_eq!(feed_repo.recalculate_unread_count(&feed_id).unwrap(), 1);
}

#[test]
fn mark_muted_unread_as_read_marks_existing_matches_and_updates_unread_count() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    db.writer()
        .execute(
            "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
            [],
        )
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let repo = SqliteArticleRepository::new(db.writer());
    let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

    let muted = make_article(&feed_id, "Kindle Unlimited offer");
    let visible = make_article(&feed_id, "Visible article");
    repo.upsert(&[muted.clone(), visible.clone()]).unwrap();
    feed_repo.recalculate_unread_count(&feed_id).unwrap();

    let changed = repo.mark_muted_unread_as_read(&account_id, None).unwrap();

    assert_eq!(changed, 1);
    let muted_is_read: bool = db
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            params![muted.id.0],
            |row| row.get(0),
        )
        .unwrap();
    let visible_is_read: bool = db
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            params![visible.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert!(muted_is_read);
    assert!(!visible_is_read);
    assert_eq!(feed_repo.recalculate_unread_count(&feed_id).unwrap(), 1);
}

#[test]
fn mark_muted_unread_as_read_preserves_star_pending_and_queues_mark_read() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRss");
    let feed_id = insert_test_feed(&db, &account_id);
    db.writer()
        .execute(
            "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
            [],
        )
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let repo = SqliteArticleRepository::new(db.writer());
    let pending_repo = SqlitePendingMutationRepository::new(db.writer());
    let remote_entry_id = "entry-star-preserved".to_string();
    let mut article = make_article(&feed_id, "Kindle Unlimited offer");
    article.remote_id = Some(remote_entry_id.clone());
    repo.upsert(&[article]).unwrap();
    pending_repo
        .save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::Star,
            remote_entry_id: remote_entry_id.clone(),
            created_at: "2026-08-27T00:00:00Z".to_string(),
        })
        .unwrap();

    let changed = repo.mark_muted_unread_as_read(&account_id, None).unwrap();

    assert_eq!(changed, 1);
    let pending = pending_repo.find_by_account(&account_id).unwrap();
    assert_eq!(pending.len(), 2);
    assert!(pending.iter().any(|mutation| {
        mutation.mutation_type == PendingMutationType::Star
            && mutation.remote_entry_id == remote_entry_id
    }));
    assert!(pending.iter().any(|mutation| {
        mutation.mutation_type == PendingMutationType::MarkRead
            && mutation.remote_entry_id == "entry-star-preserved"
    }));
}

#[test]
fn mark_muted_unread_as_read_replaces_pending_mark_unread() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRss");
    let feed_id = insert_test_feed(&db, &account_id);
    db.writer()
        .execute(
            "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
            [],
        )
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let repo = SqliteArticleRepository::new(db.writer());
    let pending_repo = SqlitePendingMutationRepository::new(db.writer());
    let remote_entry_id = "entry-read-replaced".to_string();
    let mut article = make_article(&feed_id, "Kindle Unlimited offer");
    article.remote_id = Some(remote_entry_id.clone());
    repo.upsert(&[article]).unwrap();
    pending_repo
        .save(&PendingMutation {
            id: None,
            account_id: account_id.clone(),
            mutation_type: PendingMutationType::MarkUnread,
            remote_entry_id: remote_entry_id.clone(),
            created_at: "2026-08-27T00:00:00Z".to_string(),
        })
        .unwrap();

    let changed = repo.mark_muted_unread_as_read(&account_id, None).unwrap();

    assert_eq!(changed, 1);
    let pending = pending_repo.find_by_account(&account_id).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].mutation_type, PendingMutationType::MarkRead);
    assert_eq!(pending[0].remote_entry_id, remote_entry_id);
}

#[test]
fn mark_muted_unread_as_read_limits_changes_to_candidate_ids() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    db.writer()
        .execute(
            "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
            [],
        )
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let repo = SqliteArticleRepository::new(db.writer());
    let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

    let first = make_article(&feed_id, "Kindle Unlimited one");
    let second = make_article(&feed_id, "Kindle Unlimited two");
    repo.upsert(&[first.clone(), second.clone()]).unwrap();
    feed_repo.update_unread_count(&feed_id, 99).unwrap();

    let changed = repo
        .mark_muted_unread_as_read(&account_id, Some(std::slice::from_ref(&first.id)))
        .unwrap();

    assert_eq!(changed, 1);
    let first_is_read: bool = db
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            params![first.id.0],
            |row| row.get(0),
        )
        .unwrap();
    let second_is_read: bool = db
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            params![second.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert!(first_is_read);
    let stored_unread_count: i64 = db
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            params![feed_id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(stored_unread_count, 0);
    assert!(!second_is_read);
}

#[test]
fn mark_muted_unread_as_read_for_feed_limits_empty_sync_repair_to_feed() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_a_id = insert_test_feed(&db, &account_id);
    let feed_b_id = insert_test_feed(&db, &account_id);
    db.writer()
        .execute(
            "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
            [],
        )
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let repo = SqliteArticleRepository::new(db.writer());
    let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

    let feed_a_muted = make_article(&feed_a_id, "Kindle Unlimited current feed");
    let feed_b_muted = make_article(&feed_b_id, "Kindle Unlimited sibling feed");
    repo.upsert(&[feed_a_muted.clone(), feed_b_muted.clone()])
        .unwrap();
    feed_repo.update_unread_count(&feed_a_id, 99).unwrap();
    feed_repo.update_unread_count(&feed_b_id, 77).unwrap();

    let changed =
        mark_muted_unread_as_read_for_feed_with_conn(db.writer(), &account_id, &feed_a_id).unwrap();

    assert_eq!(changed, 1);
    let feed_a_is_read: bool = db
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            params![feed_a_muted.id.0],
            |row| row.get(0),
        )
        .unwrap();
    let feed_b_is_read: bool = db
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            params![feed_b_muted.id.0],
            |row| row.get(0),
        )
        .unwrap();
    let feed_a_unread_count: i64 = db
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            params![feed_a_id.0],
            |row| row.get(0),
        )
        .unwrap();
    let feed_b_unread_count: i64 = db
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            params![feed_b_id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert!(feed_a_is_read);
    assert!(!feed_b_is_read);
    assert_eq!(feed_a_unread_count, 0);
    assert_eq!(feed_b_unread_count, 77);
}

#[test]
fn article_mutation_transaction_policy_muted_auto_read_rolls_back_on_mid_batch_failure() {
    assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    db.writer()
        .execute(
            "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
            [],
        )
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let repo = SqliteArticleRepository::new(db.writer());
    let first = make_article(&feed_id, "Kindle Unlimited first");
    let failing = make_article(&feed_id, "Kindle Unlimited failure");
    repo.upsert(&[first.clone(), failing.clone()]).unwrap();

    db.writer()
        .execute(
            "CREATE TEMP TRIGGER fail_muted_mark_read
                 BEFORE UPDATE OF is_read ON articles
                 WHEN NEW.title = 'Kindle Unlimited failure'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced muted mark read failure');
                 END",
            [],
        )
        .unwrap();

    let error = repo
        .mark_muted_unread_as_read(&account_id, None)
        .expect_err("mid-batch failure should abort the transaction");

    assert!(error.to_string().contains("forced muted mark read failure"));
    for article in [&first, &failing] {
        let is_read: bool = db
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                params![article.id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!is_read);
    }
}

#[test]
fn article_mutation_transaction_policy_muted_auto_read_handles_large_match_set() {
    assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    db.writer()
        .execute(
            "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
            [],
        )
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let repo = SqliteArticleRepository::new(db.writer());
    let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());
    let articles = (0..250)
        .map(|index| make_article(&feed_id, &format!("Kindle Unlimited batch {index}")))
        .collect::<Vec<_>>();
    repo.upsert(&articles).unwrap();
    feed_repo.recalculate_unread_count(&feed_id).unwrap();

    let changed = repo.mark_muted_unread_as_read(&account_id, None).unwrap();

    assert_eq!(changed, articles.len());
    let unread_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND is_read = 0",
            params![feed_id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(unread_count, 0);
    assert_eq!(feed_repo.recalculate_unread_count(&feed_id).unwrap(), 0);
}
