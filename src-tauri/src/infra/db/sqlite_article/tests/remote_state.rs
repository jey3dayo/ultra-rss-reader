use super::*;

#[test]
fn apply_remote_state_sets_correct_states() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut a1 = make_article(&feed_id, "Article 1");
    a1.remote_id = Some("r1".to_string());
    let mut a2 = make_article(&feed_id, "Article 2");
    a2.remote_id = Some("r2".to_string());
    let mut a3 = make_article(&feed_id, "Article 3");
    a3.remote_id = Some("r3".to_string());

    repo.upsert(&[a1.clone(), a2.clone(), a3.clone()]).unwrap();

    // r1 is read, r2 is starred, r3 is neither
    repo.apply_remote_state(
        &account_id,
        &["r1".to_string()],
        &["r2".to_string()],
        &[],
        &[],
    )
    .unwrap();

    let articles = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 100,
            },
        )
        .unwrap();

    let find = |id: &ArticleId| articles.iter().find(|a| a.id == *id).unwrap();

    assert!(find(&a1.id).is_read);
    assert!(!find(&a1.id).is_starred);

    assert!(!find(&a2.id).is_read);
    assert!(find(&a2.id).is_starred);

    assert!(!find(&a3.id).is_read);
    assert!(!find(&a3.id).is_starred);
}

#[test]
fn apply_remote_state_marks_contents_article_read_from_normalized_greader_stream_id() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());
    let mut article = make_article(&feed_id, "GReader article");
    article.remote_id = Some("tag:google.com,2005:reader/item/00000000499602d2".to_string());
    repo.upsert(&[article.clone()]).unwrap();

    repo.apply_remote_state(
        &account_id,
        &["tag:google.com,2005:reader/item/00000000499602d2".to_string()],
        &[],
        &[],
        &[],
    )
    .unwrap();

    let articles = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 100,
            },
        )
        .unwrap();
    assert!(
        articles
            .iter()
            .find(|candidate| candidate.id == article.id)
            .unwrap()
            .is_read
    );
}

#[test]
fn apply_remote_state_skips_unchanged_rows() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut read_article = make_article(&feed_id, "Read Article");
    read_article.remote_id = Some("r1".to_string());
    read_article.is_read = true;
    read_article.is_starred = false;

    let mut starred_article = make_article(&feed_id, "Starred Article");
    starred_article.remote_id = Some("r2".to_string());
    starred_article.is_read = false;
    starred_article.is_starred = true;

    repo.upsert(&[read_article, starred_article]).unwrap();

    let before = db.writer().total_changes();
    repo.apply_remote_state(
        &account_id,
        &["r1".to_string()],
        &["r2".to_string()],
        &[],
        &[],
    )
    .unwrap();

    assert_eq!(db.writer().total_changes(), before);
}

#[test]
fn apply_remote_state_skips_pending_articles() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut a1 = make_article(&feed_id, "Article 1");
    a1.remote_id = Some("r1".to_string());
    a1.is_read = true; // already read locally
    a1.is_starred = true;

    repo.upsert(&[a1.clone()]).unwrap();

    // Remote says r1 is NOT read and NOT starred, but r1 has both axes pending.
    repo.apply_remote_state(
        &account_id,
        &[],
        &[],
        &["r1".to_string()],
        &["r1".to_string()],
    )
    .unwrap();

    let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    // Should be unchanged because r1 is pending
    assert!(articles[0].is_read);
    assert!(articles[0].is_starred);
}

#[test]
fn apply_remote_state_keeps_read_pending_separate_from_star_state() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Article 1");
    article.remote_id = Some("r1".to_string());
    article.is_read = true;
    article.is_starred = false;

    repo.upsert(&[article.clone()]).unwrap();

    repo.apply_remote_state(
        &account_id,
        &[],
        &["r1".to_string()],
        &["r1".to_string()],
        &[],
    )
    .unwrap();

    let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();

    assert!(articles[0].is_read);
    assert!(articles[0].is_starred);
}

#[test]
fn apply_remote_state_keeps_star_pending_separate_from_read_state() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Article 1");
    article.remote_id = Some("r1".to_string());
    article.is_read = false;
    article.is_starred = true;

    repo.upsert(&[article.clone()]).unwrap();

    repo.apply_remote_state(
        &account_id,
        &["r1".to_string()],
        &[],
        &[],
        &["r1".to_string()],
    )
    .unwrap();

    let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();

    assert!(articles[0].is_read);
    assert!(articles[0].is_starred);
}

#[test]
fn apply_remote_state_ignores_local_like_feed_ids() {
    let db = test_db();
    let account_id = AccountId::new();
    let feed_id = FeedId::new();
    let repo = SqliteArticleRepository::new(db.writer());

    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![account_id.0, "FreshRss", "FreshRSS"],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, remote_id, title, url) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                feed_id.0,
                account_id.0,
                "https://example.com/feed.xml",
                "Local-like Feed",
                "https://example.com/feed.xml"
            ],
        )
        .unwrap();

    let mut article = make_article(&feed_id, "Article 1");
    article.remote_id = Some("local-guid-1".to_string());
    article.is_read = true;
    repo.upsert(&[article]).unwrap();

    repo.apply_remote_state(&account_id, &[], &[], &[], &[])
        .unwrap();

    let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert!(articles[0].is_read);
}

// Conflict-resolution contract (a): a queued local mutation masks the remote
// value on the same axis, so the local pending intent wins during apply while
// a non-pending entry on the same axis still adopts the remote value.
#[test]
fn local_pending_read_mutation_wins_over_remote_unread_during_apply() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    // r1 has a local "mark read" intent still queued; remote has not seen it yet.
    let mut pending_local = make_article(&feed_id, "Pending local read");
    pending_local.remote_id = Some("r1".to_string());
    pending_local.is_read = true;
    pending_local.is_starred = false;

    // r2 has no pending intent and should follow remote on the read axis.
    let mut remote_driven = make_article(&feed_id, "Remote driven read");
    remote_driven.remote_id = Some("r2".to_string());
    remote_driven.is_read = false;
    remote_driven.is_starred = false;

    repo.upsert(&[pending_local.clone(), remote_driven.clone()])
        .unwrap();

    // Remote reports neither entry as read; only r1 is pending on the read axis.
    repo.apply_remote_state(
        &account_id,
        &[],                 // remote read ids
        &[],                 // remote starred ids
        &["r1".to_string()], // pending read ids
        &[],                 // pending starred ids
    )
    .unwrap();

    let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    let find = |id: &ArticleId| articles.iter().find(|a| a.id == *id).unwrap();

    // r1 keeps the local pending read state (local wins over remote unread).
    assert!(find(&pending_local.id).is_read);
    // r2 follows remote and stays unread (remote wins when there is no pending intent).
    assert!(!find(&remote_driven.id).is_read);
    // Star axis was never touched by either remote or pending: both entries stay unstarred.
    assert!(!find(&pending_local.id).is_starred);
    assert!(!find(&remote_driven.id).is_starred);
}

// Conflict-resolution contract (b): re-applying the same remote state is
// idempotent. The second apply touches no rows and leaves identical state.
#[test]
fn reapplying_same_remote_state_is_idempotent_for_read_and_star() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut a1 = make_article(&feed_id, "Becomes read");
    a1.remote_id = Some("r1".to_string());
    let mut a2 = make_article(&feed_id, "Becomes starred");
    a2.remote_id = Some("r2".to_string());

    repo.upsert(&[a1.clone(), a2.clone()]).unwrap();

    let read_ids = ["r1".to_string()];
    let starred_ids = ["r2".to_string()];

    // First apply mutates rows to match remote.
    repo.apply_remote_state(&account_id, &read_ids, &starred_ids, &[], &[])
        .unwrap();

    let after_first = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    let find_first = |id: &ArticleId| after_first.iter().find(|a| a.id == *id).unwrap();
    assert!(find_first(&a1.id).is_read);
    assert!(find_first(&a2.id).is_starred);

    // Second apply with the identical remote state must be a no-op (idempotent).
    // total_changes() is a session-cumulative counter: it counts only DML rows
    // (INSERT/UPDATE/DELETE) and does not increment for SELECT statements.
    let before_second = db.writer().total_changes();
    repo.apply_remote_state(&account_id, &read_ids, &starred_ids, &[], &[])
        .unwrap();
    assert_eq!(db.writer().total_changes(), before_second);

    let after_second = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    let find_second = |id: &ArticleId| after_second.iter().find(|a| a.id == *id).unwrap();
    assert!(find_second(&a1.id).is_read);
    assert!(!find_second(&a1.id).is_starred);
    assert!(find_second(&a2.id).is_starred);
    assert!(!find_second(&a2.id).is_read);
}

// Conflict-resolution contract (c): after an interrupted sync, a re-sync
// converges. While the mutation is still pending, apply preserves the local
// value; once the push succeeds and the pending mask is gone, the next apply
// adopts the remote value (state converges instead of oscillating).
#[test]
fn resync_converges_state_after_pending_mutation_clears() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    // Local marked r1 read; remote has not yet observed the change.
    let mut article = make_article(&feed_id, "Interrupted read");
    article.remote_id = Some("r1".to_string());
    article.is_read = true;
    article.is_starred = false;
    repo.upsert(&[article.clone()]).unwrap();

    // Interrupted sync: push failed, mutation is still queued, so the pending
    // mask protects the local read state even though remote reports unread.
    repo.apply_remote_state(&account_id, &[], &[], &["r1".to_string()], &[])
        .unwrap();
    let mid = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert!(mid[0].is_read);
    // Star axis was never involved: still unstarred at mid-phase.
    assert!(!mid[0].is_starred);

    // Re-sync after the push succeeded and the pending mutation was cleared.
    // Remote now reflects the local change, so apply converges to remote=read.
    repo.apply_remote_state(&account_id, &["r1".to_string()], &[], &[], &[])
        .unwrap();
    let converged = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert!(converged[0].is_read);
    assert!(!converged[0].is_starred);
}
