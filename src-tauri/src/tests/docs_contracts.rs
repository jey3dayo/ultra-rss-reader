use super::*;

#[test]
fn release_bundle_identifier_contract_matches_app_data_migration_policy() {
    let tauri_config = include_str!("../../tauri.conf.json");
    let release_tauri_config = include_str!("../../tauri.release.conf.json");
    let release_manual = include_str!("../../../docs/release-manual-verification.md");

    assert!(tauri_config.contains("\"identifier\": \"com.jey3dayo.ultra-rss-reader\""));
    assert!(release_tauri_config.contains("\"identifier\": \"com.jey3dayo.ultra-rss-reader\""));
    assert!(release_manual.contains("Keep the release bundle identifier stable"));
    assert!(release_manual.contains("No automatic app data directory rename"));
    assert!(release_manual.contains("OS keyring credentials may need user re-entry"));
}

#[test]
fn rust_test_cfg_inventory_records_production_only_release_gaps() {
    let release_manual = include_str!("../../../docs/release-manual-verification.md");

    assert!(release_manual.contains("Rust Test cfg(test) And Production-Only Coverage Inventory"));
    assert!(release_manual.contains("Tauri runtime startup"));
    assert!(release_manual.contains("Panic and logging"));
    assert!(release_manual.contains("Native updater install"));
    assert!(release_manual.contains("macOS titlebar/focus"));
    assert!(release_manual.contains("Do not treat a `cargo test` pass as evidence"));
}

#[test]
fn privacy_docs_record_local_database_encryption_decision() {
    let privacy_doc = include_str!("../../../docs/feed-content-privacy.md");

    assert!(privacy_doc.contains("do not add app-managed local database encryption at rest"));
    assert!(privacy_doc.contains("Credentials remain outside the database in the OS keyring"));
    assert!(privacy_doc.contains("OS disk encryption such as FileVault or BitLocker"));
    assert!(privacy_doc.contains("backup/export encryption rules"));
}

#[test]
fn support_artifact_retention_contract_covers_reset_and_uninstall_docs() {
    let privacy_doc = include_str!("../../../docs/feed-content-privacy.md");
    let release_manual = include_str!("../../../docs/release-manual-verification.md");
    let incident_runbook = include_str!("../../../docs/incident-runbook.md");

    for doc in [privacy_doc, release_manual, incident_runbook] {
        assert!(doc.contains("support/debug logs"));
        assert!(doc.contains("support dumps"));
    }

    assert!(release_manual.contains("Uninstalling or deleting the app binary"));
    assert!(release_manual.contains("Private data reset guidance covers"));
    assert!(release_manual.contains("Manual log deletion and support dump deletion"));
    assert!(release_manual.contains("reset is incomplete"));
    assert!(incident_runbook.contains("Reset and uninstall are not the same privacy operation"));
    assert!(incident_runbook.contains("Before telling a user that private data has been cleared"));
}

#[test]
fn support_debug_copy_fingerprint_decision_excludes_stable_identifiers() {
    let privacy_doc = include_str!("../../../docs/feed-content-privacy.md");
    let release_manual = include_str!("../../../docs/release-manual-verification.md");

    for doc in [privacy_doc, release_manual] {
        assert!(doc.contains("app version"));
        assert!(doc.contains("OS family"));
        assert!(doc.contains("CPU architecture"));
        assert!(doc.contains("locale"));
        assert!(doc.contains("timezone offset"));
        assert!(doc.contains("hostname"));
        assert!(doc.contains("local filesystem paths"));
        assert!(doc.contains("OS username"));
        assert!(doc.contains("stable device identifier"));
    }

    assert!(privacy_doc.contains(
        "do not include a stable app/environment fingerprint in support or debug copy by default"
    ));
    assert!(privacy_doc.contains("user consent and redaction preview flow"));
    assert!(release_manual.contains("does not automatically include"));
    assert!(release_manual.contains("instead of adding a stable fingerprint"));
}

#[test]
fn support_dump_policy_requires_consent_and_redaction_preview() {
    let privacy_doc = include_str!("../../../docs/feed-content-privacy.md");

    assert!(privacy_doc.contains("explicit user consent and a redaction preview"));
    assert!(privacy_doc.contains("before the artifact is generated"));
    assert!(privacy_doc.contains("support dump generation must fail closed"));
    assert!(privacy_doc.contains("manually redacted app.log excerpt"));
}

#[test]
fn support_error_correlation_policy_avoids_stable_diagnostics_identifiers() {
    let privacy_doc = include_str!("../../../docs/feed-content-privacy.md");

    assert!(privacy_doc.contains("stable support code"));
    assert!(privacy_doc.contains("ephemeral log-correlation values"));
    assert!(privacy_doc.contains("must not be reused across unrelated support tickets"));
    assert!(privacy_doc.contains("must not encode private data"));
}

#[test]
fn incident_runbook_covers_runtime_database_recovery_surface() {
    let incident_runbook = include_str!("../../../docs/incident-runbook.md");

    assert!(incident_runbook.contains("runtime database recovery"));
    assert!(incident_runbook.contains("read-only degraded mode"));
    assert!(incident_runbook.contains("integrity check action"));
    assert!(incident_runbook.contains("DB lock failure, permission denied, and disk full"));
}

#[test]
fn main_window_title_bar_overlay_flag_matches_platform_expectation() {
    assert_eq!(
        main_window_title_bar_uses_overlay(),
        cfg!(target_os = "macos")
    );
}
