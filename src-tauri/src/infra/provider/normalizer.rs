use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{FeedIdentifier, RemoteEntry};
use crate::domain::url_policy::{has_url_credentials, is_private_host};

const MAX_PROVIDER_METADATA_URL_BYTES: usize = 2048;
const MAX_PROVIDER_FEED_ENTRIES: usize = 10_000;
const MAX_PROVIDER_ENTRY_TEXT_CHARS: usize = 1_000_000;

fn contains_control_char(value: &str) -> bool {
    value.chars().any(char::is_control)
}

pub fn normalize_provider_metadata_url(raw_url: &str) -> Option<String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty()
        || trimmed.len() > MAX_PROVIDER_METADATA_URL_BYTES
        || contains_control_char(trimmed)
    {
        return None;
    }

    let mut url = reqwest::Url::parse(trimmed).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }
    if url.host_str().is_some_and(is_private_host) {
        return None;
    }
    if has_url_credentials(&url) {
        return None;
    }
    url.set_fragment(None);
    Some(url.to_string())
}

fn truncate_provider_entry_text(value: String) -> String {
    let mut char_indices = value.char_indices();
    match char_indices.nth(MAX_PROVIDER_ENTRY_TEXT_CHARS) {
        Some((byte_index, _)) => value[..byte_index].to_string(),
        None => value,
    }
}

fn truncate_provider_entry_optional_text(value: Option<String>) -> Option<String> {
    value.map(truncate_provider_entry_text)
}

pub fn normalize_provider_article_url(raw_url: &str) -> Option<String> {
    normalize_http_article_url(raw_url, ArticleUrlCredentialPolicy::Reject)
}

pub fn normalize_trusted_backend_article_url(raw_url: &str) -> Option<String> {
    normalize_http_article_url(raw_url, ArticleUrlCredentialPolicy::Strip)
}

#[derive(Debug, Clone, Copy)]
enum ArticleUrlCredentialPolicy {
    Reject,
    Strip,
}

fn normalize_http_article_url(
    raw_url: &str,
    credential_policy: ArticleUrlCredentialPolicy,
) -> Option<String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty()
        || trimmed.len() > MAX_PROVIDER_METADATA_URL_BYTES
        || contains_control_char(trimmed)
    {
        return None;
    }

    let mut url = reqwest::Url::parse(trimmed).ok()?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return None;
    }
    if has_url_credentials(&url) {
        match credential_policy {
            ArticleUrlCredentialPolicy::Reject => return None,
            ArticleUrlCredentialPolicy::Strip => {
                let _ = url.set_username("");
                let _ = url.set_password(None);
            }
        }
    }
    url.set_fragment(None);
    Some(url.to_string())
}

pub fn normalize_feed(feed_data: &[u8], feed_url: &str) -> DomainResult<Vec<RemoteEntry>> {
    let feed = feed_rs::parser::parse(feed_data).map_err(|e| DomainError::Parse(e.to_string()))?;

    Ok(feed
        .entries
        .into_iter()
        .take(MAX_PROVIDER_FEED_ENTRIES)
        .map(|entry| {
            let url = select_article_url(&entry.links);
            let published_at = entry.published.or(entry.updated);
            let updated_at = entry.updated;
            let thumbnail = extract_thumbnail(&entry);
            let content = entry
                .content
                .and_then(|c| c.body)
                .or_else(|| entry.summary.as_ref().map(|s| s.content.clone()))
                .unwrap_or_default();

            RemoteEntry {
                id: if entry.id.trim().is_empty() {
                    None
                } else {
                    Some(entry.id)
                },
                source_feed_id: FeedIdentifier::Local {
                    feed_url: feed_url.to_string(),
                },
                title: truncate_provider_entry_text(
                    entry.title.map(|t| t.content).unwrap_or_default(),
                ),
                content: truncate_provider_entry_text(content),
                summary: truncate_provider_entry_optional_text(entry.summary.map(|s| s.content)),
                url,
                published_at,
                updated_at,
                thumbnail,
                author: truncate_provider_entry_optional_text(
                    entry.authors.first().map(|a| a.name.clone()),
                ),
                is_read: None,
                is_starred: None,
            }
        })
        .collect())
}

fn select_article_url(links: &[feed_rs::model::Link]) -> Option<String> {
    links
        .iter()
        .filter(|link| is_article_html_link(link))
        .find_map(|link| normalize_provider_article_url(&link.href))
        .or_else(|| {
            links
                .iter()
                .filter(|link| !link.href.trim().is_empty())
                .find_map(|link| normalize_provider_article_url(&link.href))
        })
}

fn is_article_html_link(link: &feed_rs::model::Link) -> bool {
    if link.href.trim().is_empty() {
        return false;
    }

    let rel = link.rel.as_deref().unwrap_or("alternate");
    if !rel.eq_ignore_ascii_case("alternate") {
        return false;
    }

    link.media_type
        .as_deref()
        .is_none_or(is_html_article_media_type)
}

fn is_html_article_media_type(media_type: &str) -> bool {
    let media_type = media_type.split(';').next().unwrap_or("").trim();

    media_type.eq_ignore_ascii_case("text/html")
        || media_type.eq_ignore_ascii_case("application/xhtml+xml")
}

fn extract_thumbnail(entry: &feed_rs::model::Entry) -> Option<String> {
    // Try media content first, then enclosures
    entry
        .media
        .first()
        .and_then(|m| m.content.first())
        .and_then(|c| c.url.as_ref())
        .and_then(|u| normalize_provider_metadata_url(u.as_str()))
        .or_else(|| {
            entry
                .links
                .iter()
                .find(|l| is_image_media_type(l.media_type.as_deref()) && !l.href.trim().is_empty())
                .and_then(|l| normalize_provider_metadata_url(&l.href))
        })
}

fn is_image_media_type(media_type: Option<&str>) -> bool {
    media_type
        .map(|media_type| media_type.trim().to_ascii_lowercase().starts_with("image/"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests;
