use super::{
    account_credential_cleanup_contract, delete_account_then_password,
    delete_account_with_sync_boundary, invalid_account_row_recovery_contract,
    normalize_new_freshrss_server_url, normalize_updated_account_server_url,
    provider_account_scale_guidance_contract, provider_credential_verification_request_contract,
    save_account_after_optional_password, update_account_credentials_after_optional_password,
    validate_account_name, validate_account_name_with_excluded_id, validate_account_sync_settings,
    validate_add_account_args, validate_freshrss_server_url, AccountCredentialCleanupFailurePolicy,
    AccountCredentialCleanupStep, AccountRecoveryAction, ProviderScaleGuidanceSurface,
};
use crate::commands::dto::AppError;
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

fn fresh_rss_account() -> Account {
    Account {
        id: AccountId::new(),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".to_string(),
        server_url: Some("https://rss.example.com".to_string()),
        username: Some("alice".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

#[test]
fn validates_add_account_args_by_provider_kind() {
    assert_eq!(
        validate_add_account_args("Local", None, None, None).unwrap(),
        ProviderKind::Local
    );
    assert_eq!(
        validate_add_account_args(
            "FreshRss",
            Some("https://rss.example.com"),
            Some("alice"),
            Some("secret"),
        )
        .unwrap(),
        ProviderKind::FreshRss
    );

    assert!(validate_add_account_args("FreshRss", None, Some("alice"), Some("secret")).is_err());
    assert!(
        validate_add_account_args("FreshRss", Some("   "), Some("alice"), Some("secret")).is_err()
    );
    assert!(validate_add_account_args(
        "FreshRss",
        Some("https://rss.example.com"),
        None,
        Some("secret")
    )
    .is_err());
    assert!(validate_add_account_args(
        "FreshRss",
        Some("https://rss.example.com"),
        Some("   "),
        Some("secret")
    )
    .is_err());
    assert!(validate_add_account_args(
        "FreshRss",
        Some("https://rss.example.com"),
        Some("alice"),
        None
    )
    .is_err());
    assert!(validate_add_account_args("Unknown", None, None, None).is_err());
}

#[test]
fn validates_new_freshrss_server_url_policy() {
    assert_eq!(
        normalize_new_freshrss_server_url(" https://rss.example.com/root ").unwrap(),
        "https://rss.example.com/root"
    );

    for server_url in [
        "ftp://rss.example.com",
        "https://alice:secret@rss.example.com",
        "https://localhost",
        "http://127.0.0.1:8080",
        "https://10.0.0.1",
        "https://172.16.0.1",
        "https://192.168.0.1",
        "https://[::1]",
        "https://[fd00::1]",
    ] {
        assert!(
            normalize_new_freshrss_server_url(server_url).is_err(),
            "{server_url} should be rejected"
        );
    }
}

#[test]
fn rejects_ipv4_mapped_ipv6_private_hosts() {
    for server_url in [
        "http://[::ffff:127.0.0.1]/",
        "http://[::ffff:169.254.169.254]/",
        "http://[::ffff:10.0.0.1]/",
        "http://[::ffff:192.168.0.1]/",
    ] {
        assert!(
            normalize_new_freshrss_server_url(server_url).is_err(),
            "{server_url} should be rejected"
        );
    }

    for server_url in ["http://[::ffff:8.8.8.8]/", "https://[2001:db8::1]/"] {
        assert!(
            normalize_new_freshrss_server_url(server_url).is_ok(),
            "{server_url} should be accepted"
        );
    }
}

#[test]
fn validates_sync_settings_range() {
    assert!(validate_account_sync_settings(60, 1).is_ok());
    assert!(validate_account_sync_settings(3600, 0).is_ok());
    assert!(validate_account_sync_settings(86_400, 3650).is_ok());
    assert!(validate_account_sync_settings(59, 30).is_err());
    assert!(validate_account_sync_settings(86_401, 30).is_err());
    assert!(validate_account_sync_settings(3600, -1).is_err());
    assert!(validate_account_sync_settings(3600, 3651).is_err());
}

#[test]
fn validate_account_name_trims_and_rejects_empty_or_duplicate_names() {
    let existing = vec![fresh_rss_account()];

    assert_eq!(
        validate_account_name("  Work FreshRSS  ", &existing).unwrap(),
        "Work FreshRSS"
    );
    assert!(validate_account_name("   ", &existing).is_err());
    assert!(validate_account_name(&"a".repeat(101), &existing).is_err());
    assert!(validate_account_name("FreshRSS", &existing).is_err());
    assert!(validate_account_name("  FreshRSS  ", &existing).is_err());
    assert!(validate_account_name("freshrss", &existing).is_err());
    assert!(validate_account_name("  FRESHRSS  ", &existing).is_err());
}

#[test]
fn validate_account_name_rejects_case_insensitive_duplicates_except_current_account() {
    let mut existing = fresh_rss_account();
    existing.name = "Work".to_string();
    let accounts = vec![existing.clone()];

    assert_eq!(
        validate_account_name_with_excluded_id(" work ", &accounts, Some(&existing.id)).unwrap(),
        "work"
    );
    assert!(
        validate_account_name_with_excluded_id(" work ", &accounts, Some(&AccountId::new()))
            .is_err()
    );
}

#[test]
fn validate_freshrss_server_url_rejects_missing_or_blank_urls() {
    let mut account = fresh_rss_account();

    assert_eq!(
        validate_freshrss_server_url(&account).unwrap(),
        "https://rss.example.com"
    );

    account.server_url = None;
    assert!(validate_freshrss_server_url(&account).is_err());

    account.server_url = Some("   ".to_string());
    assert!(validate_freshrss_server_url(&account).is_err());
}

#[test]
fn normalizes_updated_freshrss_server_url_with_new_account_policy() {
    let account = fresh_rss_account();

    assert_eq!(
        normalize_updated_account_server_url(&account, Some(" https://rss.example.com/root "))
            .unwrap(),
        Some("https://rss.example.com/root".to_string())
    );

    for server_url in [
        None,
        Some("   "),
        Some("ftp://rss.example.com"),
        Some("https://alice:secret@rss.example.com"),
        Some("http://localhost:8080"),
        Some("http://127.0.0.1"),
        Some("http://[::1]"),
        Some("not a url"),
    ] {
        assert!(
            normalize_updated_account_server_url(&account, server_url).is_err(),
            "{server_url:?} should be rejected"
        );
    }
}

#[test]
fn normalize_updated_account_server_url_keeps_non_freshrss_policy() {
    let mut account = fresh_rss_account();

    account.kind = ProviderKind::Local;
    assert_eq!(
        normalize_updated_account_server_url(&account, Some(" local value ")).unwrap(),
        Some(" local value ".to_string())
    );

    account.kind = ProviderKind::Quarantined;
    assert_eq!(
        normalize_updated_account_server_url(&account, Some("https://rss.example.com")).unwrap(),
        None
    );
}

#[test]
fn add_account_rolls_back_keyring_entry_when_db_save_fails() {
    let account = fresh_rss_account();
    let saved_passwords = RefCell::new(Vec::new());
    let deleted_passwords = RefCell::new(Vec::new());

    let result = save_account_after_optional_password(
        &account,
        Some("secret"),
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |_| {
            Err(AppError::UserVisible {
                message: "db failed".to_string(),
            })
        },
        |account_id| {
            deleted_passwords.borrow_mut().push(account_id.to_string());
            Ok(())
        },
    );

    assert!(result.is_err());
    assert_eq!(
        saved_passwords.borrow().as_slice(),
        &[(account.id.as_ref().to_string(), "secret".to_string())]
    );
    assert_eq!(
        deleted_passwords.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
}

#[test]
fn add_account_does_not_create_db_account_when_keyring_save_fails() {
    let account = fresh_rss_account();
    let saved_accounts = RefCell::new(Vec::new());
    let deleted_passwords = RefCell::new(Vec::new());

    let error = save_account_after_optional_password(
        &account,
        Some("secret"),
        |_, _| {
            Err(AppError::UserVisible {
                message: "keyring failed".to_string(),
            })
        },
        |account| {
            saved_accounts
                .borrow_mut()
                .push(account.id.as_ref().to_string());
            Ok(())
        },
        |account_id| {
            deleted_passwords.borrow_mut().push(account_id.to_string());
            Ok(())
        },
    )
    .expect_err("keyring save failure should stop account creation before DB save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "keyring failed"
    ));
    assert!(saved_accounts.borrow().is_empty());
    assert!(deleted_passwords.borrow().is_empty());
}

#[test]
fn add_account_keeps_original_db_error_when_keyring_rollback_fails() {
    let account = fresh_rss_account();

    let error = save_account_after_optional_password(
        &account,
        Some("secret"),
        |_, _| Ok(()),
        |_| {
            Err(AppError::UserVisible {
                message: "db failed".to_string(),
            })
        },
        |_| {
            Err(AppError::UserVisible {
                message: "rollback failed".to_string(),
            })
        },
    )
    .expect_err("DB save failure should remain the returned error");

    match error {
        AppError::UserVisible { message } => assert_eq!(message, "db failed"),
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            panic!("unexpected retryable error: {message}");
        }
    }
}

#[test]
fn update_account_credentials_does_not_save_password_before_account_exists() {
    let read_passwords = RefCell::new(Vec::new());
    let saved_passwords = RefCell::new(Vec::new());

    let error = update_account_credentials_after_optional_password(
        &AccountId("missing-account".to_string()),
        Some("secret"),
        |_| Ok(None),
        |_| Ok(()),
        |account_id| {
            read_passwords.borrow_mut().push(account_id.to_string());
            Ok("old-secret".to_string())
        },
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |_| Ok(()),
    )
    .expect_err("missing account should be rejected before keyring save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Account not found"
    ));
    assert!(read_passwords.borrow().is_empty());
    assert!(saved_passwords.borrow().is_empty());
}

#[test]
fn update_account_credentials_restores_previous_password_when_db_update_fails() {
    let account = fresh_rss_account();
    let read_passwords = RefCell::new(Vec::new());
    let saved_passwords = RefCell::new(Vec::new());

    let error = update_account_credentials_after_optional_password(
        &account.id,
        Some("new-secret"),
        |_| Ok(Some(account.clone())),
        |_| {
            Err(AppError::UserVisible {
                message: "db failed".to_string(),
            })
        },
        |account_id| {
            read_passwords.borrow_mut().push(account_id.to_string());
            Ok("old-secret".to_string())
        },
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |_| Ok(()),
    )
    .expect_err("DB update failure should be returned");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "db failed"
    ));
    assert_eq!(
        read_passwords.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert_eq!(
        saved_passwords.borrow().as_slice(),
        &[
            (account.id.as_ref().to_string(), "new-secret".to_string()),
            (account.id.as_ref().to_string(), "old-secret".to_string()),
        ]
    );
}

#[test]
fn update_account_credentials_keeps_new_password_when_db_update_succeeds() {
    let account = fresh_rss_account();
    let read_passwords = RefCell::new(Vec::new());
    let saved_passwords = RefCell::new(Vec::new());
    let updated_accounts = RefCell::new(Vec::new());

    let updated = update_account_credentials_after_optional_password(
        &account.id,
        Some("new-secret"),
        |_| Ok(Some(account.clone())),
        |account_id| {
            updated_accounts
                .borrow_mut()
                .push(account_id.as_ref().to_string());
            Ok(())
        },
        |account_id| {
            read_passwords.borrow_mut().push(account_id.to_string());
            Ok("old-secret".to_string())
        },
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |_| Ok(()),
    )
    .expect("successful credential update should keep the new keyring password");

    assert_eq!(updated.id, account.id);
    assert_eq!(
        read_passwords.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert_eq!(
        updated_accounts.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert_eq!(
        saved_passwords.borrow().as_slice(),
        &[(account.id.as_ref().to_string(), "new-secret".to_string())]
    );
}

#[test]
fn update_account_credentials_saves_password_when_previous_password_is_missing() {
    let account = fresh_rss_account();
    let read_passwords = RefCell::new(Vec::new());
    let saved_passwords = RefCell::new(Vec::new());
    let updated_accounts = RefCell::new(Vec::new());
    let deleted_passwords = RefCell::new(Vec::new());

    let updated = update_account_credentials_after_optional_password(
        &account.id,
        Some("new-secret"),
        |_| Ok(Some(account.clone())),
        |account_id| {
            updated_accounts
                .borrow_mut()
                .push(account_id.as_ref().to_string());
            Ok(())
        },
        |account_id| {
            read_passwords.borrow_mut().push(account_id.to_string());
            Err(AppError::UserVisible {
                message: "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again.".to_string(),
            })
        },
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |account_id| {
            deleted_passwords.borrow_mut().push(account_id.to_string());
            Ok(())
        },
    )
    .expect("missing previous password should allow saving a replacement password");

    assert_eq!(updated.id, account.id);
    assert_eq!(
        read_passwords.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert_eq!(
        updated_accounts.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert_eq!(
        saved_passwords.borrow().as_slice(),
        &[(account.id.as_ref().to_string(), "new-secret".to_string())]
    );
    assert!(deleted_passwords.borrow().is_empty());
}

#[test]
fn update_account_credentials_deletes_new_password_when_db_update_fails_without_previous_password()
{
    let account = fresh_rss_account();
    let saved_passwords = RefCell::new(Vec::new());
    let deleted_passwords = RefCell::new(Vec::new());

    let error = update_account_credentials_after_optional_password(
        &account.id,
        Some("new-secret"),
        |_| Ok(Some(account.clone())),
        |_| {
            Err(AppError::UserVisible {
                message: "db failed".to_string(),
            })
        },
        |_| {
            Err(AppError::UserVisible {
                message: "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again.".to_string(),
            })
        },
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |account_id| {
            deleted_passwords.borrow_mut().push(account_id.to_string());
            Ok(())
        },
    )
    .expect_err("DB update failure should be returned after deleting the new password");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "db failed"
    ));
    assert_eq!(
        saved_passwords.borrow().as_slice(),
        &[(account.id.as_ref().to_string(), "new-secret".to_string())]
    );
    assert_eq!(
        deleted_passwords.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
}

#[test]
fn update_account_credentials_keeps_existing_keyring_entry_for_empty_password() {
    let account = fresh_rss_account();
    let read_passwords = RefCell::new(Vec::new());
    let saved_passwords = RefCell::new(Vec::new());
    let updated_accounts = RefCell::new(Vec::new());

    let updated = update_account_credentials_after_optional_password(
        &account.id,
        Some(""),
        |_| Ok(Some(account.clone())),
        |account_id| {
            updated_accounts
                .borrow_mut()
                .push(account_id.as_ref().to_string());
            Ok(())
        },
        |account_id| {
            read_passwords.borrow_mut().push(account_id.to_string());
            Ok("old-secret".to_string())
        },
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |_| Ok(()),
    )
    .expect("empty password draft should not block metadata credential updates");

    assert_eq!(updated.id, account.id);
    assert_eq!(
        updated_accounts.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert!(read_passwords.borrow().is_empty());
    assert!(saved_passwords.borrow().is_empty());
}

#[test]
fn update_account_credentials_does_not_mutate_db_or_password_when_old_password_read_fails() {
    let account = fresh_rss_account();
    let updated_accounts = RefCell::new(Vec::new());
    let saved_passwords = RefCell::new(Vec::new());

    let error = update_account_credentials_after_optional_password(
        &account.id,
        Some("new-secret"),
        |_| Ok(Some(account.clone())),
        |account_id| {
            updated_accounts
                .borrow_mut()
                .push(account_id.as_ref().to_string());
            Ok(())
        },
        |_| {
            Err(AppError::UserVisible {
                message: "keyring read failed".to_string(),
            })
        },
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            Ok(())
        },
        |_| Ok(()),
    )
    .expect_err("old credential read failure should stop before mutation");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "keyring read failed"
    ));
    assert!(updated_accounts.borrow().is_empty());
    assert!(saved_passwords.borrow().is_empty());
}

#[test]
fn update_account_credentials_keeps_db_error_when_previous_password_restore_fails() {
    let account = fresh_rss_account();
    let saved_passwords = RefCell::new(Vec::new());

    let error = update_account_credentials_after_optional_password(
        &account.id,
        Some("new-secret"),
        |_| Ok(Some(account.clone())),
        |_| {
            Err(AppError::UserVisible {
                message: "db failed".to_string(),
            })
        },
        |_| Ok("old-secret".to_string()),
        |account_id, password| {
            saved_passwords
                .borrow_mut()
                .push((account_id.to_string(), password.to_string()));
            if password == "old-secret" {
                return Err(AppError::UserVisible {
                    message: "restore failed".to_string(),
                });
            }
            Ok(())
        },
        |_| Ok(()),
    )
    .expect_err("DB update failure should stay the returned error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "db failed"
    ));
    assert_eq!(
        saved_passwords.borrow().as_slice(),
        &[
            (account.id.as_ref().to_string(), "new-secret".to_string()),
            (account.id.as_ref().to_string(), "old-secret".to_string()),
        ]
    );
}

#[test]
fn delete_account_does_not_delete_password_when_db_delete_fails() {
    let account = fresh_rss_account();
    let deleted_accounts = RefCell::new(Vec::new());
    let deleted_passwords = RefCell::new(Vec::new());

    let error = delete_account_then_password(
        &account.id,
        |account_id| {
            deleted_accounts
                .borrow_mut()
                .push(account_id.as_ref().to_string());
            Err(AppError::UserVisible {
                message: "db delete failed".to_string(),
            })
        },
        |account_id| {
            deleted_passwords.borrow_mut().push(account_id.to_string());
            Ok(())
        },
    )
    .expect_err("DB delete failure should be returned");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "db delete failed"
    ));
    assert_eq!(
        deleted_accounts.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert!(deleted_passwords.borrow().is_empty());
}

#[test]
fn delete_account_deletes_password_after_db_delete_success() {
    let account = fresh_rss_account();
    let deleted_accounts = RefCell::new(Vec::new());
    let deleted_passwords = RefCell::new(Vec::new());

    delete_account_then_password(
        &account.id,
        |account_id| {
            assert!(deleted_passwords.borrow().is_empty());
            deleted_accounts
                .borrow_mut()
                .push(account_id.as_ref().to_string());
            Ok(())
        },
        |account_id| {
            deleted_passwords.borrow_mut().push(account_id.to_string());
            Ok(())
        },
    )
    .expect("successful account delete should clean up the keyring entry");

    assert_eq!(
        deleted_accounts.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert_eq!(
        deleted_passwords.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
}

#[test]
fn delete_account_keeps_db_delete_when_password_delete_fails() {
    let account = fresh_rss_account();
    let deleted_accounts = RefCell::new(Vec::new());
    let deleted_passwords = RefCell::new(Vec::new());

    delete_account_then_password(
        &account.id,
        |account_id| {
            deleted_accounts
                .borrow_mut()
                .push(account_id.as_ref().to_string());
            Ok(())
        },
        |account_id| {
            deleted_passwords.borrow_mut().push(account_id.to_string());
            Err(AppError::UserVisible {
                message: "keyring delete failed".to_string(),
            })
        },
    )
    .expect("keyring cleanup failure should not roll back DB account delete");

    assert_eq!(
        deleted_accounts.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
    assert_eq!(
        deleted_passwords.borrow().as_slice(),
        &[account.id.as_ref().to_string()]
    );
}

#[test]
fn delete_account_command_rejects_while_sync_boundary_is_busy() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(true);

    let error = delete_account_with_sync_boundary(
        &db,
        &syncing,
        AccountId("missing-account".to_string()),
        |_| Ok(()),
    )
    .expect_err("account delete should not run while sync boundary is busy");

    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[test]
fn delete_account_command_releases_sync_boundary_after_delete() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account_id = AccountId("account-delete-boundary".to_string());
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
                [&account_id.0],
            )
            .unwrap();
    }
    let syncing = AtomicBool::new(false);

    delete_account_with_sync_boundary(&db, &syncing, account_id, |_| Ok(()))
        .expect("account delete should succeed");

    assert!(!syncing.load(Ordering::SeqCst));
}

#[test]
fn account_delete_cleanup_contract_keeps_keyring_orphans_from_reappearing() {
    let contract = account_credential_cleanup_contract();

    assert_eq!(
        contract.steps,
        vec![
            AccountCredentialCleanupStep::DeleteDatabaseAccount,
            AccountCredentialCleanupStep::DeleteKeyringCredential,
        ]
    );
    assert_eq!(
        contract.keyring_delete_failure_policy,
        AccountCredentialCleanupFailurePolicy::WarnAfterDatabaseDelete
    );
    assert!(
        !contract.rename_deletes_keyring_credential,
        "account rename keeps the stable account id, so deleting the keyring entry would orphan the live account"
    );
}

#[test]
fn quarantined_account_rows_have_diagnostics_and_recovery_actions() {
    let contract = invalid_account_row_recovery_contract();

    assert_eq!(contract.diagnostics_event, "account.row.quarantined");
    assert_eq!(
        contract.recovery_actions,
        vec![
            AccountRecoveryAction::DeleteAccount,
            AccountRecoveryAction::RecreateAccount,
            AccountRecoveryAction::ContactSupport,
        ]
    );
    assert!(contract.preserves_account_id);
    assert!(contract.exposes_displayable_row);
}

#[test]
fn provider_account_scale_guidance_contract_is_advisory_smoke() {
    let contract = provider_account_scale_guidance_contract();

    assert_eq!(
        contract.surface,
        ProviderScaleGuidanceSurface::AccountSettingsAdvisory
    );
    assert_eq!(
        contract.max_feeds_guidance,
        "provider_specific_advisory_not_enforced"
    );
    assert_eq!(
        contract.max_articles_guidance,
        "provider_specific_advisory_not_enforced"
    );
    assert_eq!(
        contract.warning_threshold_guidance,
        "warn_from_observed_performance_not_fixed_protocol_limit"
    );
    assert_eq!(
        contract.performance_diagnostics,
        "record_account_kind_feed_count_article_count_and_sync_duration_class"
    );
    assert!(contract.no_hard_limit_copy);
}

#[test]
fn account_create_update_do_not_request_provider_credential_verification() {
    let contract = provider_credential_verification_request_contract();

    assert!(!contract.create_requests_connection_test);
    assert!(!contract.update_requests_connection_test);
    assert_eq!(
        contract.explicit_verification_command,
        "test_account_connection"
    );
    assert_eq!(
        contract.mutation_status_after_create_or_update,
        ConnectionVerificationStatus::Unverified
    );
}
