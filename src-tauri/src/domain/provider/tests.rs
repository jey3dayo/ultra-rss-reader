use super::*;

#[test]
fn provider_capability_matrix_is_fixed_by_account_kind() {
    let matrix = [
        (
            ProviderKind::Local,
            ProviderCapabilities {
                supports_folders: false,
                supports_starring: false,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: false,
            },
            ProviderDeletionRetentionPolicy {
                missing_remote_feed: ProviderSideDeletionRetention::NotApplicable,
                missing_remote_folder: ProviderSideDeletionRetention::NotApplicable,
            },
            ProviderOptimisticMutationConflictPolicy {
                read_state: RemoteDeleteOptimisticMutationConflict::NotApplicable,
                star_state: RemoteDeleteOptimisticMutationConflict::NotApplicable,
            },
        ),
        (
            ProviderKind::FreshRss,
            ProviderCapabilities {
                supports_folders: true,
                supports_starring: true,
                supports_search: true,
                supports_delta_sync: true,
                supports_remote_state: true,
            },
            ProviderDeletionRetentionPolicy {
                missing_remote_feed: ProviderSideDeletionRetention::DeleteLocal,
                missing_remote_folder: ProviderSideDeletionRetention::DeleteLocal,
            },
            ProviderOptimisticMutationConflictPolicy {
                read_state: RemoteDeleteOptimisticMutationConflict::KeepPendingLocalMutation,
                star_state: RemoteDeleteOptimisticMutationConflict::KeepPendingLocalMutation,
            },
        ),
        (
            ProviderKind::Quarantined,
            ProviderCapabilities {
                supports_folders: false,
                supports_starring: false,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: false,
            },
            ProviderDeletionRetentionPolicy {
                missing_remote_feed: ProviderSideDeletionRetention::NotApplicable,
                missing_remote_folder: ProviderSideDeletionRetention::NotApplicable,
            },
            ProviderOptimisticMutationConflictPolicy {
                read_state: RemoteDeleteOptimisticMutationConflict::NotApplicable,
                star_state: RemoteDeleteOptimisticMutationConflict::NotApplicable,
            },
        ),
    ];

    for (kind, capabilities, deletion_policy, mutation_policy) in matrix {
        assert_eq!(kind.capabilities(), capabilities);
        assert_eq!(kind.deletion_retention_policy(), deletion_policy);
        assert_eq!(kind.optimistic_mutation_conflict_policy(), mutation_policy);
    }
}

#[test]
fn freshrss_capability_is_connected_to_greader_product_diagnostics() {
    let capabilities = ProviderKind::FreshRss.capabilities();
    let identity = ProviderKind::FreshRss.api_identity();

    assert!(capabilities.supports_read_state_mutations());
    assert!(capabilities.supports_star_state_mutations());
    assert!(capabilities.supports_delta_sync);
    assert!(capabilities.supports_remote_state);
    assert_eq!(identity.protocol, "greader");
    assert_eq!(identity.server_product, "FreshRSS");
    assert_eq!(
        identity.server_product_version_detection,
        "unsupported_by_greader_contract"
    );
    assert_eq!(identity.diagnostics_product_label, "freshrss-greader");
    assert_ne!(identity.diagnostics_product_label, identity.server_product);
}

#[test]
fn local_and_quarantined_capabilities_disable_remote_mutation_actions() {
    for kind in [ProviderKind::Local, ProviderKind::Quarantined] {
        let capabilities = kind.capabilities();

        assert!(!capabilities.supports_read_state_mutations());
        assert!(!capabilities.supports_star_state_mutations());
        assert!(!capabilities.supports_remote_state);
        assert!(!capabilities.supports_starring);
    }
}

#[test]
fn provider_auth_semantics_document_token_refresh_contract() {
    let local = ProviderKind::Local.auth_semantics();
    assert_eq!(local.credential_material, "none");
    assert_eq!(local.token_expiry, "not_applicable");
    assert_eq!(local.refresh_strategy, "not_applicable");
    assert_eq!(local.expiry_recovery, "not_applicable");

    let freshrss = ProviderKind::FreshRss.auth_semantics();
    assert_eq!(
        freshrss.credential_material,
        "username_password_client_login"
    );
    assert_eq!(freshrss.token_expiry, "server_defined_not_reported");
    assert_eq!(
        freshrss.refresh_strategy,
        "reauthenticate_before_each_sync_session"
    );
    assert_eq!(
        freshrss.expiry_recovery,
        "treat_401_403_as_auth_failure_and_scheduler_backoff"
    );

    let quarantined = ProviderKind::Quarantined.auth_semantics();
    assert_eq!(quarantined.credential_material, "none");
    assert_eq!(quarantined.token_expiry, "not_applicable");
    assert_eq!(quarantined.refresh_strategy, "sync_disabled");
    assert_eq!(quarantined.expiry_recovery, "sync_disabled");
}

#[test]
fn provider_clock_policy_keeps_server_time_out_of_backoff() {
    let freshrss = ProviderKind::FreshRss.clock_policy();
    assert_eq!(
        freshrss.server_timestamp_source,
        "greader_timestamp_usec_updated_published"
    );
    assert_eq!(
        freshrss.cursor_timestamp_policy,
        "oldest_seen_timestamp_usec_with_equal_timestamp_guard"
    );
    assert_eq!(
        freshrss.backoff_time_source,
        "local_scheduler_clock_with_retry_after_floor"
    );
    assert_eq!(
        freshrss.skew_policy,
        "use_provider_item_time_only_for_cursor_never_for_retry_schedule"
    );
}

#[test]
fn provider_side_deletion_retention_policy_is_fixed_by_account_kind() {
    assert_eq!(
        ProviderKind::Local.deletion_retention_policy(),
        ProviderDeletionRetentionPolicy {
            missing_remote_feed: ProviderSideDeletionRetention::NotApplicable,
            missing_remote_folder: ProviderSideDeletionRetention::NotApplicable,
        }
    );
    assert_eq!(
        ProviderKind::FreshRss.deletion_retention_policy(),
        ProviderDeletionRetentionPolicy {
            missing_remote_feed: ProviderSideDeletionRetention::DeleteLocal,
            missing_remote_folder: ProviderSideDeletionRetention::DeleteLocal,
        }
    );
    assert_eq!(
        ProviderKind::Quarantined.deletion_retention_policy(),
        ProviderDeletionRetentionPolicy {
            missing_remote_feed: ProviderSideDeletionRetention::NotApplicable,
            missing_remote_folder: ProviderSideDeletionRetention::NotApplicable,
        }
    );
}

#[test]
fn remote_delete_optimistic_mutation_conflict_policy_follows_provider_capability() {
    let local = ProviderKind::Local.optimistic_mutation_conflict_policy();
    assert_eq!(
        local.read_state,
        RemoteDeleteOptimisticMutationConflict::NotApplicable
    );
    assert_eq!(
        local.star_state,
        RemoteDeleteOptimisticMutationConflict::NotApplicable
    );

    let freshrss = ProviderKind::FreshRss.optimistic_mutation_conflict_policy();
    assert_eq!(
        freshrss.read_state,
        RemoteDeleteOptimisticMutationConflict::KeepPendingLocalMutation
    );
    assert_eq!(
        freshrss.star_state,
        RemoteDeleteOptimisticMutationConflict::KeepPendingLocalMutation
    );

    let quarantined = ProviderKind::Quarantined.optimistic_mutation_conflict_policy();
    assert_eq!(
        quarantined.read_state,
        RemoteDeleteOptimisticMutationConflict::NotApplicable
    );
    assert_eq!(
        quarantined.star_state,
        RemoteDeleteOptimisticMutationConflict::NotApplicable
    );
}

#[test]
fn is_greader_managed_feed_remote_id_matches_feed_prefix_only() {
    assert!(is_greader_managed_feed_remote_id(Some("feed/1")));
    assert!(is_greader_managed_feed_remote_id(Some(
        "feed/http://example.com/rss"
    )));
    assert!(!is_greader_managed_feed_remote_id(Some("user/-/label/x")));
    assert!(!is_greader_managed_feed_remote_id(Some("")));
    assert!(!is_greader_managed_feed_remote_id(None));
}
