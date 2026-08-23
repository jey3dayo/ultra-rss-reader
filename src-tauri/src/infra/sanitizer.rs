use std::borrow::Cow;

use crate::domain::url_policy;

pub const SANITIZER_VERSION: u32 = 3;
const SANITIZER_ADDED_TAGS: &[&str] = &[
    "img",
    "picture",
    "figure",
    "figcaption",
    "video",
    "source",
    "blockquote",
    "pre",
    "code",
];
const SANITIZER_IMG_ATTRS: &[&str] = &[
    "src",
    "srcset",
    "sizes",
    "alt",
    "width",
    "height",
    "loading",
    "referrerpolicy",
];
const SANITIZER_VIDEO_ATTRS: &[&str] = &["src", "controls", "width", "height"];
const SANITIZER_SOURCE_ATTRS: &[&str] = &["src", "srcset", "sizes", "type", "media"];
const REDACTED_LINK_TITLE: &str = "External link";
const REDACTED_IMAGE_TITLE: &str = "External image";

pub fn sanitize_html(raw: &str) -> String {
    sanitize_untrusted_feed_html(raw)
}

pub fn sanitize_untrusted_feed_html(raw: &str) -> String {
    sanitize_article_html(raw)
}

pub fn sanitize_trusted_backend_html(raw: &str) -> String {
    sanitize_article_html(raw)
}

fn sanitize_article_html(raw: &str) -> String {
    if raw.trim().is_empty() {
        return String::new();
    }

    let sanitized = ammonia::Builder::default()
        .add_tags(SANITIZER_ADDED_TAGS)
        .add_tag_attributes("img", SANITIZER_IMG_ATTRS)
        .add_tag_attributes("video", SANITIZER_VIDEO_ATTRS)
        .add_tag_attributes("source", SANITIZER_SOURCE_ATTRS)
        .url_schemes(std::collections::HashSet::from(["http", "https"]))
        .attribute_filter(|_, attribute, value| {
            if attribute.eq_ignore_ascii_case("href") {
                return is_public_absolute_http_url(value).then_some(Cow::Borrowed(value));
            }

            if attribute.eq_ignore_ascii_case("src") {
                return is_public_absolute_http_url(value).then_some(Cow::Borrowed(value));
            }

            if attribute.eq_ignore_ascii_case("srcset") {
                return filter_srcset(value).map(Cow::Owned);
            }

            if attribute.eq_ignore_ascii_case("title") {
                return Some(Cow::Borrowed(redact_url_title(value).unwrap_or(value)));
            }

            Some(Cow::Borrowed(value))
        })
        .clean(raw)
        .to_string();

    apply_reader_media_policy(&sanitized)
}

fn filter_srcset(srcset: &str) -> Option<String> {
    let filtered = srcset_candidates(srcset)
        .filter_map(|candidate| {
            let candidate = candidate.trim();
            if candidate.is_empty() {
                return None;
            }

            let url_end = candidate
                .find(|character: char| character.is_ascii_whitespace())
                .unwrap_or(candidate.len());
            let url = &candidate[..url_end];
            is_safe_srcset_url(url).then(|| candidate.to_string())
        })
        .collect::<Vec<_>>()
        .join(", ");

    (!filtered.is_empty()).then_some(filtered)
}

fn srcset_candidates(srcset: &str) -> impl Iterator<Item = &str> {
    let mut candidate_start = 0;
    let mut has_descriptor = false;
    let mut has_url = false;
    let mut candidates = Vec::new();

    for (index, character) in srcset.char_indices() {
        if character.is_ascii_whitespace() {
            if has_url {
                has_descriptor = true;
            }
            continue;
        }

        if character == ',' && has_descriptor {
            candidates.push(&srcset[candidate_start..index]);
            candidate_start = index + character.len_utf8();
            has_descriptor = false;
            has_url = false;
            continue;
        }

        has_url = true;
    }

    candidates.push(&srcset[candidate_start..]);
    candidates.into_iter()
}

fn is_safe_srcset_url(url: &str) -> bool {
    let trimmed = url.trim();
    if trimmed.is_empty() || trimmed.chars().any(char::is_control) {
        return false;
    }

    is_public_absolute_http_url(trimmed)
}

fn is_public_absolute_http_url(url: &str) -> bool {
    reqwest::Url::parse(url).is_ok_and(|parsed| {
        matches!(parsed.scheme(), "http" | "https")
            && parsed.username().is_empty()
            && parsed.password().is_none()
            && !parsed.host_str().is_some_and(url_policy::is_private_host)
    })
}

fn redact_url_title(value: &str) -> Option<&'static str> {
    reqwest::Url::parse(value.trim())
        .is_ok()
        .then_some(REDACTED_LINK_TITLE)
}

fn apply_reader_media_policy(sanitized: &str) -> String {
    use kuchikiki::traits::TendrilSink;

    let document = kuchikiki::parse_html().one(sanitized).document_node;
    if let Ok(images) = document.select("img") {
        for image in images {
            let mut attributes = image.attributes.borrow_mut();
            attributes.insert("loading", "lazy".to_string());
            attributes.insert("referrerpolicy", "no-referrer".to_string());
            if attributes.get("title") == Some(REDACTED_LINK_TITLE) {
                attributes.insert("title", REDACTED_IMAGE_TITLE.to_string());
            }
        }
    }

    let mut bytes = Vec::new();
    if let Some(body) = document
        .select("body")
        .ok()
        .and_then(|mut body| body.next())
    {
        for child in body.as_node().children() {
            child
                .serialize(&mut bytes)
                .expect("sanitized HTML serialization should succeed");
        }
    } else {
        document
            .serialize(&mut bytes)
            .expect("sanitized HTML serialization should succeed");
    }
    String::from_utf8(bytes).expect("sanitized HTML should serialize as UTF-8")
}

pub fn extract_visible_text(raw: &str) -> String {
    if raw.trim().is_empty() {
        return String::new();
    }

    use kuchikiki::traits::{NodeIterator, TendrilSink};

    let document = kuchikiki::parse_html().one(raw).document_node;
    for matched_node in document
        .select("script, style")
        .expect("static script/style selector should parse")
    {
        matched_node.as_node().detach();
    }

    document
        .inclusive_descendants()
        .text_nodes()
        .filter(|text_node| {
            !text_node.as_node().ancestors().any(|ancestor| {
                ancestor.as_element().is_some_and(|element| {
                    let local_name = element.name.local.as_ref();
                    local_name == "script" || local_name == "style"
                })
            })
        })
        .flat_map(|text_node| {
            text_node
                .borrow()
                .split_whitespace()
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests;
