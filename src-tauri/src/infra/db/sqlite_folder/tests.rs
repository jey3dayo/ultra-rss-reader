use super::*;
use crate::infra::db::connection::DbManager;

fn test_db() -> DbManager {
    DbManager::new_in_memory().unwrap()
}

fn insert_test_account(db: &DbManager) -> AccountId {
    let id = AccountId::new();
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![id.0, "Local", "Test"],
        )
        .unwrap();
    id
}

#[test]
fn save_and_find_by_account() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    let folder = Folder {
        id: FolderId::new(),
        account_id: account_id.clone(),
        remote_id: None,
        name: "Tech".to_string(),
        sort_order: 1,
    };
    repo.save(&folder).unwrap();

    let folders = repo.find_by_account(&account_id).unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0].name, "Tech");
}

#[test]
fn save_rejects_missing_account_on_migration_applied_db() {
    let db = test_db();
    let repo = SqliteFolderRepository::new(db.writer());
    let missing_account_id = AccountId("missing-account".to_string());
    let folder = Folder {
        id: FolderId::new(),
        account_id: missing_account_id.clone(),
        remote_id: None,
        name: "Orphan".to_string(),
        sort_order: 0,
    };

    let result = repo.save(&folder);

    assert!(result.is_err());
    assert!(repo
        .find_by_account(&missing_account_id)
        .unwrap()
        .is_empty());
}

#[test]
fn delete_sets_feed_folder_id_to_null() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    let folder = Folder {
        id: FolderId::new(),
        account_id: account_id.clone(),
        remote_id: None,
        name: "Tech".to_string(),
        sort_order: 0,
    };
    repo.save(&folder).unwrap();

    // Insert a feed referencing this folder
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url) VALUES ('f1', ?1, ?2, 'Feed', 'http://f.com')",
            params![account_id.0, folder.id.0],
        )
        .unwrap();

    repo.delete(&folder.id).unwrap();

    let folder_id: Option<String> = db
        .reader()
        .query_row("SELECT folder_id FROM feeds WHERE id = 'f1'", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert!(folder_id.is_none());
}

#[test]
fn delete_renumbers_remaining_folders_within_the_same_account() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let other_account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    for (id, name, sort_order) in [
        ("folder-a", "A", 0),
        ("folder-b", "B", 1),
        ("folder-c", "C", 2),
    ] {
        repo.save(&Folder {
            id: FolderId(id.to_string()),
            account_id: account_id.clone(),
            remote_id: None,
            name: name.to_string(),
            sort_order,
        })
        .unwrap();
    }
    repo.save(&Folder {
        id: FolderId("other-folder".to_string()),
        account_id: other_account_id.clone(),
        remote_id: None,
        name: "Other".to_string(),
        sort_order: 7,
    })
    .unwrap();

    repo.delete(&FolderId("folder-b".to_string())).unwrap();

    let folders = repo.find_by_account(&account_id).unwrap();
    let orders = folders
        .iter()
        .map(|folder| (folder.id.0.as_str(), folder.sort_order))
        .collect::<Vec<_>>();
    assert_eq!(orders, vec![("folder-a", 0), ("folder-c", 1)]);

    let other_folder = repo.find_by_account(&other_account_id).unwrap();
    assert_eq!(other_folder[0].sort_order, 7);
}

#[test]
fn delete_rolls_back_when_renumber_fails() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    for (id, name, sort_order) in [
        ("folder-a", "A", 0),
        ("folder-b", "B", 1),
        ("folder-c", "C", 2),
    ] {
        repo.save(&Folder {
            id: FolderId(id.to_string()),
            account_id: account_id.clone(),
            remote_id: None,
            name: name.to_string(),
            sort_order,
        })
        .unwrap();
    }
    db.writer()
        .execute_batch(
            "CREATE TRIGGER fail_folder_c_renumber
             BEFORE UPDATE OF sort_order ON folders
             WHEN OLD.id = 'folder-c'
             BEGIN
               SELECT RAISE(ABORT, 'renumber failed');
             END;",
        )
        .unwrap();

    let result = repo.delete(&FolderId("folder-b".to_string()));

    assert!(result.is_err());
    let folders = repo.find_by_account(&account_id).unwrap();
    let orders = folders
        .iter()
        .map(|folder| (folder.id.0.as_str(), folder.sort_order))
        .collect::<Vec<_>>();
    assert_eq!(
        orders,
        vec![("folder-a", 0), ("folder-b", 1), ("folder-c", 2)]
    );
}

#[test]
fn save_updates_existing_folder_without_clearing_feed_assignments() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    let folder = Folder {
        id: FolderId::new(),
        account_id: account_id.clone(),
        remote_id: Some("remote-folder".to_string()),
        name: "Tech".to_string(),
        sort_order: 0,
    };
    repo.save(&folder).unwrap();

    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url) VALUES ('f1', ?1, ?2, 'Feed', 'http://f.com')",
            params![account_id.0, folder.id.0],
        )
        .unwrap();

    let updated_folder = Folder {
        name: "Engineering".to_string(),
        sort_order: 2,
        ..folder.clone()
    };
    repo.save(&updated_folder).unwrap();

    let folder_id: Option<String> = db
        .reader()
        .query_row("SELECT folder_id FROM feeds WHERE id = 'f1'", [], |row| {
            row.get(0)
        })
        .unwrap();
    let saved_name: String = db
        .reader()
        .query_row(
            "SELECT name FROM folders WHERE id = ?1",
            params![folder.id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(folder_id.as_deref(), Some(folder.id.0.as_str()));
    assert_eq!(saved_name, "Engineering");
}

#[test]
fn find_by_remote_id_separates_identical_remote_id_by_account() {
    let db = test_db();
    let account_a_id = insert_test_account(&db);
    let account_b_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    let folder_a = Folder {
        id: FolderId::new(),
        account_id: account_a_id.clone(),
        remote_id: Some("remote-folder".to_string()),
        name: "Account A".to_string(),
        sort_order: 0,
    };
    let folder_b = Folder {
        id: FolderId::new(),
        account_id: account_b_id.clone(),
        remote_id: Some("remote-folder".to_string()),
        name: "Account B".to_string(),
        sort_order: 0,
    };
    repo.save(&folder_a).unwrap();
    repo.save(&folder_b).unwrap();

    let found_a = repo
        .find_by_remote_id(&account_a_id, "remote-folder")
        .unwrap()
        .expect("folder for account A should be found");
    let found_b = repo
        .find_by_remote_id(&account_b_id, "remote-folder")
        .unwrap()
        .expect("folder for account B should be found");

    assert_eq!(found_a.id, folder_a.id);
    assert_eq!(found_a.account_id, account_a_id);
    assert_eq!(found_b.id, folder_b.id);
    assert_eq!(found_b.account_id, account_b_id);
}

#[test]
fn find_by_account_ordered_by_sort_order() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    for (name, order) in [("C", 3), ("A", 1), ("B", 2)] {
        let folder = Folder {
            id: FolderId::new(),
            account_id: account_id.clone(),
            remote_id: None,
            name: name.to_string(),
            sort_order: order,
        };
        repo.save(&folder).unwrap();
    }

    let folders = repo.find_by_account(&account_id).unwrap();
    let names: Vec<&str> = folders.iter().map(|f| f.name.as_str()).collect();
    assert_eq!(names, vec!["A", "B", "C"]);
}

#[test]
fn find_by_account_repairs_duplicate_sort_order_before_creating_unique_index() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let other_account_id = insert_test_account(&db);
    db.writer()
        .execute_batch(
            "DROP INDEX IF EXISTS idx_folders_account_sort_order_unique;
             DROP INDEX IF EXISTS idx_folders_account_name_nocase_unique;",
        )
        .unwrap();
    for (id, account_id, name) in [
        ("folder-a", account_id.as_ref(), "A"),
        ("folder-b", account_id.as_ref(), "B"),
        ("folder-c", account_id.as_ref(), "C"),
        ("folder-other", other_account_id.as_ref(), "Other"),
    ] {
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, 0)",
                params![id, account_id, name],
            )
            .unwrap();
    }
    let repo = SqliteFolderRepository::new(db.writer());

    let folders = repo.find_by_account(&account_id).unwrap();
    let orders = folders
        .iter()
        .map(|folder| (folder.id.0.as_str(), folder.sort_order))
        .collect::<Vec<_>>();
    let other_folder = repo.find_by_account(&other_account_id).unwrap();

    assert_eq!(
        orders,
        vec![("folder-a", 0), ("folder-b", 1), ("folder-c", 2)]
    );
    assert_eq!(other_folder[0].sort_order, 0);
    db.reader()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-duplicate', ?1, 'Duplicate', 0)",
            params![account_id.as_ref()],
        )
        .expect_err("unique sort_order index should be active after repair");
}

#[test]
fn find_by_account_repairs_case_duplicate_names_before_creating_unique_index() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    db.writer()
        .execute_batch(
            "DROP INDEX IF EXISTS idx_folders_account_sort_order_unique;
             DROP INDEX IF EXISTS idx_folders_account_name_nocase_unique;",
        )
        .unwrap();
    for (id, remote_id, name, sort_order) in [
        ("folder-news-upper", "user/-/label/News", "News", 2),
        ("folder-news-lower", "user/-/label/news", "news", 0),
        ("folder-tech", "user/-/label/Tech", "Tech", 1),
    ] {
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, remote_id, name, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, account_id.as_ref(), remote_id, name, sort_order],
            )
            .unwrap();
    }
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url)
             VALUES ('feed-news', ?1, 'folder-news-upper', 'News Feed', 'https://example.com/news.xml', 'https://example.com')",
            params![account_id.as_ref()],
        )
        .unwrap();
    let repo = SqliteFolderRepository::new(db.writer());

    let folders = repo.find_by_account(&account_id).unwrap();
    let folder_ids = folders
        .iter()
        .map(|folder| folder.id.0.as_str())
        .collect::<Vec<_>>();
    let feed_folder_id: String = db
        .reader()
        .query_row(
            "SELECT folder_id FROM feeds WHERE id = 'feed-news'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(folder_ids, vec!["folder-tech", "folder-news-upper"]);
    assert_eq!(feed_folder_id, "folder-news-upper");
    db.reader()
        .execute(
            "INSERT INTO folders (id, account_id, remote_id, name, sort_order) VALUES ('folder-news-duplicate', ?1, 'user/-/label/NEWS', 'NEWS', 3)",
            params![account_id.as_ref()],
        )
        .expect_err("unique name index should be active after repair");
}

#[test]
fn find_by_account_allows_same_sort_order_in_different_accounts() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let other_account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    for (id, name, account_id) in [
        ("folder-a", "A", account_id.clone()),
        ("folder-b", "B", other_account_id),
    ] {
        let folder = Folder {
            id: FolderId(id.to_string()),
            account_id,
            remote_id: None,
            name: name.to_string(),
            sort_order: 0,
        };
        repo.save(&folder).unwrap();
    }

    let folders = repo.find_by_account(&account_id).unwrap();
    let ids: Vec<&str> = folders.iter().map(|folder| folder.id.0.as_str()).collect();

    assert_eq!(ids, vec!["folder-a"]);
}

#[test]
fn save_rejects_duplicate_sort_order_within_account() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    repo.save(&Folder {
        id: FolderId("folder-a".to_string()),
        account_id: account_id.clone(),
        remote_id: None,
        name: "A".to_string(),
        sort_order: 0,
    })
    .unwrap();

    let result = repo.save(&Folder {
        id: FolderId("folder-b".to_string()),
        account_id,
        remote_id: None,
        name: "B".to_string(),
        sort_order: 0,
    });

    assert!(result.is_err());
}

#[test]
fn save_rejects_duplicate_name_case_insensitive_within_account() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    repo.save(&Folder {
        id: FolderId("folder-a".to_string()),
        account_id: account_id.clone(),
        remote_id: None,
        name: "Tech".to_string(),
        sort_order: 0,
    })
    .unwrap();

    let result = repo.save(&Folder {
        id: FolderId("folder-b".to_string()),
        account_id,
        remote_id: None,
        name: "tech".to_string(),
        sort_order: 1,
    });

    assert!(result.is_err());
}

#[test]
fn save_rejects_unicode_case_collision_within_account() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteFolderRepository::new(db.writer());

    repo.save(&Folder {
        id: FolderId("folder-a".to_string()),
        account_id: account_id.clone(),
        remote_id: Some("user/-/label/İstanbul".to_string()),
        name: "İstanbul".to_string(),
        sort_order: 0,
    })
    .unwrap();

    let result = repo.save(&Folder {
        id: FolderId("folder-b".to_string()),
        account_id,
        remote_id: Some("user/-/label/i\u{307}stanbul".to_string()),
        name: "i\u{307}stanbul".to_string(),
        sort_order: 1,
    });

    assert!(result.is_err());
}
