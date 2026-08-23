use serde::Serialize;
use tauri::utils::config::Config;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::Update;
use tracing::warn;

use super::state::PendingUpdateHandle;

const UPDATE_CHANNEL_STABLE: &str = "stable";
const UPDATE_SOURCE_LATEST_JSON: &str = "github-latest-json";

pub(crate) fn is_updater_manual_check_configured(config: &Config) -> bool {
    let Some(updater_config) = config.plugins.0.get("updater") else {
        return false;
    };

    let has_endpoint = updater_config
        .get("endpoints")
        .and_then(|value| value.as_array())
        .is_some_and(|endpoints| {
            endpoints.iter().any(|endpoint| {
                endpoint
                    .as_str()
                    .is_some_and(|endpoint| !endpoint.trim().is_empty())
            })
        });

    let has_pubkey = updater_config
        .get("pubkey")
        .and_then(|value| value.as_str())
        .is_some_and(|pubkey| !pubkey.trim().is_empty());

    has_endpoint && has_pubkey
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub body: Option<String>,
    pub channel: String,
    pub prerelease: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct DownloadProgress {
    pub(crate) session_id: u64,
    pub(crate) percent: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct UpdateReady {
    pub(crate) session_id: u64,
}

pub(crate) fn update_event_emit_warning(event: &str, error: &impl std::fmt::Display) -> String {
    format!("Failed to emit {event} event during update flow: {error}")
}

pub(crate) fn emit_update_event_log_only<S>(app: &AppHandle, event: &str, payload: S)
where
    S: Serialize + Clone,
{
    if let Err(error) = app.emit(event, payload) {
        warn!("{}", update_event_emit_warning(event, &error));
    }
}

pub(crate) fn is_prerelease_version(version: &str) -> bool {
    version
        .split_once('-')
        .is_some_and(|(_, pre)| !pre.is_empty())
}

pub(crate) fn parse_semantic_version_parts(version: &str) -> Option<[u64; 3]> {
    let without_build = match version.split_once('+') {
        Some((core, build)) if is_semantic_version_identifier_list(build) => core,
        Some(_) => return None,
        None => version,
    };
    let core = without_build
        .split_once('-')
        .map_or(Some(without_build), |(core, prerelease)| {
            is_semantic_version_identifier_list(prerelease).then_some(core)
        })?;
    let mut parts = core.split('.');
    let major = parse_semantic_version_number(parts.next()?)?;
    let minor = parse_semantic_version_number(parts.next()?)?;
    let patch = parse_semantic_version_number(parts.next()?)?;
    if parts.next().is_some() {
        return None;
    }
    Some([major, minor, patch])
}

pub(crate) fn is_semantic_version_identifier_list(value: &str) -> bool {
    !value.is_empty()
        && value.split('.').all(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
        })
}

pub(crate) fn parse_semantic_version_number(part: &str) -> Option<u64> {
    if part.is_empty() || (part.len() > 1 && part.starts_with('0')) {
        return None;
    }
    part.parse().ok()
}

pub(crate) fn is_strictly_newer_version(candidate: &str, current: &str) -> Option<bool> {
    let candidate_parts = parse_semantic_version_parts(candidate)?;
    let current_parts = parse_semantic_version_parts(current)?;
    Some(candidate_parts > current_parts)
}

pub(crate) fn update_channel(update: &Update) -> String {
    update
        .raw_json
        .get("channel")
        .and_then(|value| value.as_str())
        .unwrap_or(UPDATE_CHANNEL_STABLE)
        .trim()
        .to_string()
}

pub(crate) fn update_prerelease(update: &Update) -> bool {
    update
        .raw_json
        .get("prerelease")
        .and_then(|value| value.as_bool())
        .unwrap_or_else(|| is_prerelease_version(&update.version))
}

pub(crate) fn update_source(update: &Update) -> String {
    update
        .raw_json
        .get("source")
        .and_then(|value| value.as_str())
        .unwrap_or(UPDATE_SOURCE_LATEST_JSON)
        .trim()
        .to_string()
}

pub(crate) fn update_policy_error(update: &Update) -> Option<String> {
    update_policy_error_parts(
        &update.version,
        &update.current_version,
        &update_channel(update),
        update_prerelease(update),
    )
}

pub(crate) fn update_policy_error_parts(
    version: &str,
    current_version: &str,
    channel: &str,
    prerelease: bool,
) -> Option<String> {
    if channel != UPDATE_CHANNEL_STABLE {
        return Some(format!("Unsupported update channel: {channel}"));
    }

    if prerelease {
        return Some(format!("Prerelease update is not allowed: {version}"));
    }

    let Some(is_newer_version) = is_strictly_newer_version(version, current_version) else {
        return Some(format!(
            "Malformed semantic update version is not allowed: {version} <= {current_version}",
        ));
    };

    if !is_newer_version {
        return Some(format!(
            "Downgrade or same-version update is not allowed: {version} <= {current_version}",
        ));
    }

    None
}

pub(crate) fn make_update_info(update: &Update) -> UpdateInfo {
    UpdateInfo {
        version: update.version.clone(),
        body: update.body.clone(),
        channel: update_channel(update),
        prerelease: update_prerelease(update),
        source: update_source(update),
    }
}

pub(crate) fn make_pending_update_handle(update: Update) -> PendingUpdateHandle {
    PendingUpdateHandle {
        version: update.version.clone(),
        source: update_source(&update),
        update,
        downloaded_bytes: None,
    }
}

pub(crate) fn pending_update_metadata_matches_parts(
    cached_version: &str,
    cached_source: &str,
    current_version: &str,
    current_source: &str,
) -> bool {
    cached_version == current_version && cached_source == current_source
}

pub(crate) fn pending_update_metadata_matches(
    version: &str,
    source: &str,
    update: &Update,
) -> bool {
    pending_update_metadata_matches_parts(version, source, &update.version, &update_source(update))
}

pub(crate) fn updater_initialization_error_message(error: impl std::fmt::Display) -> String {
    format!("Updater unavailable during manual update check: {error}")
}

pub(crate) fn updater_endpoint_error_message(error: impl std::fmt::Display) -> String {
    format!("Update endpoint unavailable during manual update check: {error}")
}
