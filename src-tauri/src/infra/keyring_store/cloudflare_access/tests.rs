use super::*;
use test_support::SyncAccessGuard;

#[test]
fn cloudflare_access_sync_overrides_isolate_accounts_and_cleanup_on_drop() {
    let missing_id = uuid::Uuid::new_v4().to_string();
    let unavailable_id = uuid::Uuid::new_v4().to_string();
    let unrelated_id = uuid::Uuid::new_v4().to_string();
    let missing = SyncAccessGuard::new(&missing_id, Ok(None));
    let unavailable = SyncAccessGuard::new(&unavailable_id, Err(AccessStoreError::Unavailable));

    assert_eq!(load_for_sync(&missing_id), Ok(None));
    assert_eq!(
        load_for_sync(&unavailable_id),
        Err(AccessStoreError::Unavailable)
    );
    assert!(test_support::lookup(&unrelated_id).is_none());

    drop(missing);
    assert!(test_support::lookup(&missing_id).is_none());
    assert_eq!(
        load_for_sync(&unavailable_id),
        Err(AccessStoreError::Unavailable)
    );
    drop(unavailable);
    assert!(test_support::lookup(&unavailable_id).is_none());
}

#[test]
fn cloudflare_access_sync_override_restores_previous_account_result() {
    let account_id = uuid::Uuid::new_v4().to_string();
    let access = CloudflareAccess::new("dummy-id", "cfast_dummy", "https://example.com")
        .expect("dummy Access fixture should have valid HTTPS credentials");
    let configured = SyncAccessGuard::new(&account_id, Ok(Some(access.clone())));
    {
        let _missing = SyncAccessGuard::new(&account_id, Ok(None));
        assert_eq!(load_for_sync(&account_id), Ok(None));
    }
    assert_eq!(load_for_sync(&account_id), Ok(Some(access)));
    drop(configured);
    assert!(test_support::lookup(&account_id).is_none());
}

#[test]
fn cloudflare_access_validates_https_origin_and_opaque_headers() {
    for secret in ["cfast_dummy-token", "0123456789abcdef"] {
        let access =
            CloudflareAccess::new("dummy.access", secret, "https://EXAMPLE.com:443/root").unwrap();
        assert_eq!(access.origin(), "https://example.com");
        assert!(access
            .ensure_origin("https://example.com/elsewhere")
            .is_ok());
        for url in [
            "http://example.com",
            "https://other.com",
            "https://example.com:8443",
        ] {
            assert!(access.ensure_origin(url).is_err());
        }
        let headers = access.headers().unwrap();
        assert!(headers[CLIENT_SECRET_HEADER].is_sensitive());
        assert!(!format!("{access:?} {headers:?}").contains(secret));
    }
    for (id, secret, url) in [
        ("", "dummy", "https://example.com"),
        ("dummy", "  ", "https://example.com"),
        ("dummy\r\nInjected: x", "dummy", "https://example.com"),
        ("dummy", "dummy\nsecret", "https://example.com"),
        ("dummy", "dummy", "http://example.com"),
        ("dummy", "dummy", "https://user:pass@example.com"),
    ] {
        assert!(CloudflareAccess::new(id, secret, url).is_err());
    }
}

#[test]
fn cloudflare_access_malformed_entries_are_typed_and_redacted() {
    for value in [
        "cfast_dummy_secret",
        r#"{"client_id":"dummy","client_secret":"dummy","https_origin":"http://example.com"}"#,
        r#"{"client_id":"dummy","https_origin":"https://example.com"}"#,
        r#"{"client_id":"dummy","client_secret":"dummy","https_origin":"https://example.com/path"}"#,
    ] {
        let error = decode_bundle(value).unwrap_err();
        assert_eq!(error, AccessStoreError::Malformed);
        assert!(!format!("{error:?} {error}").contains("cfast_dummy_secret"));
    }
    let access = decode_bundle(r#"{"client_id":"dummy","client_secret":"cfast_dummy","https_origin":"https://example.com"}"#).unwrap();
    assert_eq!(access.client_id(), "dummy");
}
