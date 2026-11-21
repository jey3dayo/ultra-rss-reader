//! FreshRSS Fever API access for per-feed last-success times.
//!
//! The GReader API exposes no per-feed fetch state, but FreshRSS keeps the
//! last successful refresh time per feed and exposes it only through the
//! Fever API (`feeds[].last_updated_on_time`). The Fever `api_key` is the MD5
//! of `username:api-password`, derivable from the same credentials ClientLogin
//! already uses, so no extra credential storage is needed.

use chrono::{DateTime, Utc};
use md5::{Digest, Md5};
use serde::{Deserialize, Deserializer};

use super::GReaderProvider;
use crate::domain::error::{DomainError, DomainResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeverFeedLastSuccess {
    pub url: String,
    pub last_success_at: Option<DateTime<Utc>>,
}

pub(super) fn fever_api_key(username: &str, password: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(format!("{username}:{password}").as_bytes());
    hex::encode(hasher.finalize())
}

fn fever_base(api_base: &str) -> Option<String> {
    api_base
        .strip_suffix("greader.php")
        .map(|prefix| format!("{prefix}fever.php"))
}

#[derive(Deserialize)]
struct FeverFeedsResponse {
    #[serde(default)]
    auth: i64,
    #[serde(default)]
    feeds: Vec<FeverFeed>,
}

#[derive(Deserialize)]
struct FeverFeed {
    #[serde(default)]
    url: String,
    #[serde(default, deserialize_with = "deserialize_i64_from_string_or_number")]
    last_updated_on_time: i64,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum IntOrString {
    Int(i64),
    String(String),
}

fn deserialize_i64_from_string_or_number<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    match Option::<IntOrString>::deserialize(deserializer)? {
        Some(IntOrString::Int(value)) => Ok(value),
        Some(IntOrString::String(value)) => value.parse::<i64>().map_err(serde::de::Error::custom),
        None => Ok(0),
    }
}

impl GReaderProvider {
    /// Per-feed last successful refresh times as FreshRSS reports them via
    /// the Fever API. Callers treat any error as "signal unavailable": this
    /// is a best-effort supplement to the GReader sync, never a sync blocker.
    pub(crate) async fn get_fever_feed_last_successes(
        &self,
    ) -> DomainResult<Vec<FeverFeedLastSuccess>> {
        let api_key = self.fever_api_key.as_deref().ok_or_else(|| {
            DomainError::Auth("Fever API key is unavailable before authentication".into())
        })?;
        let base = fever_base(&self.api_base).ok_or_else(|| {
            DomainError::Validation("Cannot derive the Fever API endpoint".into())
        })?;
        let url = format!("{base}?api&feeds");
        let body = format!("api_key={}", super::urlencoded(api_key));
        let resp = self
            .request(reqwest::Method::POST, &url)?
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|error| self.map_request_error(error))
            .and_then(Self::ensure_success_response)?;
        let response: FeverFeedsResponse = Self::read_json_response(resp).await?;
        if response.auth != 1 {
            return Err(DomainError::Auth("Fever API authentication failed".into()));
        }

        Ok(response
            .feeds
            .into_iter()
            .filter(|feed| !feed.url.is_empty())
            .map(|feed| FeverFeedLastSuccess {
                url: feed.url,
                last_success_at: DateTime::from_timestamp(feed.last_updated_on_time, 0)
                    .filter(|value| *value > DateTime::UNIX_EPOCH),
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::{fever_api_key, fever_base, FeverFeedsResponse};

    #[test]
    fn fever_api_key_is_md5_of_username_and_password() {
        // md5("kevin:freshrss"), the shape FreshRSS documents for Fever auth.
        assert_eq!(
            fever_api_key("kevin", "freshrss"),
            "4a6911fb47a87a77f4de285f4fac856d",
        );
    }

    #[test]
    fn fever_base_swaps_the_greader_script_name() {
        assert_eq!(
            fever_base("https://example.com/api/greader.php").as_deref(),
            Some("https://example.com/api/fever.php"),
        );
        assert_eq!(fever_base("https://example.com/api/other.php"), None);
    }

    #[test]
    fn fever_feeds_response_accepts_int_and_string_timestamps() {
        let parsed: FeverFeedsResponse = serde_json::from_str(
            r#"{"api_version":3,"auth":1,"feeds":[
                {"id":1,"url":"http://bridge.example/a.xml","last_updated_on_time":1763000000},
                {"id":2,"url":"http://bridge.example/b.xml","last_updated_on_time":"1763000100"}
            ]}"#,
        )
        .expect("fever feeds response should parse");
        assert_eq!(parsed.auth, 1);
        assert_eq!(parsed.feeds.len(), 2);
        assert_eq!(parsed.feeds[0].last_updated_on_time, 1763000000);
        assert_eq!(parsed.feeds[1].last_updated_on_time, 1763000100);
    }
}
