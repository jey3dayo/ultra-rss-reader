use crate::infra::provider::normalizer;

pub(super) fn resolve_feed_site_url(feed_url: &str, raw_site_url: &str) -> Option<String> {
    let trimmed = raw_site_url.trim();
    if trimmed.is_empty() {
        return None;
    }

    let resolved = reqwest::Url::parse(feed_url)
        .and_then(|base_url| base_url.join(trimmed))
        .ok()?;
    normalizer::normalize_provider_metadata_url(resolved.as_str())
}

pub(super) fn select_feed_site_url(feed: &feed_rs::model::Feed, feed_url: &str) -> String {
    feed.links
        .iter()
        .find(|link| {
            let rel = link.rel.as_deref().unwrap_or("alternate");
            let media_type = link.media_type.as_deref().unwrap_or("text/html");
            !link.href.trim().is_empty()
                && rel.eq_ignore_ascii_case("alternate")
                && media_type.eq_ignore_ascii_case("text/html")
        })
        .or_else(|| feed.links.iter().find(|link| !link.href.trim().is_empty()))
        .and_then(|link| resolve_feed_site_url(feed_url, &link.href))
        .unwrap_or_else(|| feed_url.to_string())
}

pub(super) fn select_raw_feed_site_url(feed_body: &[u8], feed_url: &str) -> Option<String> {
    let body = String::from_utf8_lossy(feed_body);
    extract_raw_link_href(&body)
        .or_else(|| extract_rss_channel_link_text(&body))
        .and_then(|raw_url| resolve_feed_site_url(feed_url, &raw_url))
}

fn extract_raw_link_href(body: &str) -> Option<String> {
    let lower_body = body.to_ascii_lowercase();
    let mut search_from = 0;
    while let Some(start_offset) = lower_body[search_from..].find("<link") {
        let start = search_from + start_offset;
        let remaining = &lower_body[start..];
        let end_offset = remaining.find('>')?;
        let tag = &body[start..start + end_offset + 1];
        search_from = start + end_offset + 1;

        let rel = extract_raw_attribute(tag, "rel").unwrap_or_else(|| "alternate".into());
        let media_type = extract_raw_attribute(tag, "type").unwrap_or_else(|| "text/html".into());
        if !rel
            .split_ascii_whitespace()
            .any(|token| token.eq_ignore_ascii_case("alternate"))
            || !media_type.eq_ignore_ascii_case("text/html")
        {
            continue;
        }

        if let Some(href) =
            extract_raw_attribute(tag, "href").filter(|href| !href.trim().is_empty())
        {
            return Some(href);
        }
    }

    None
}

fn extract_raw_attribute(tag: &str, name: &str) -> Option<String> {
    for quote in ['"', '\''] {
        let pattern = format!("{name}={quote}");
        let lower_tag = tag.to_ascii_lowercase();
        let Some(start) = lower_tag.find(&pattern) else {
            continue;
        };
        let value_start = start + pattern.len();
        let Some(end_offset) = tag[value_start..].find(quote) else {
            continue;
        };
        return Some(tag[value_start..value_start + end_offset].to_string());
    }

    None
}

fn extract_rss_channel_link_text(body: &str) -> Option<String> {
    let lower_body = body.to_ascii_lowercase();
    let channel_start = lower_body.find("<channel").unwrap_or(0);
    let channel_end = lower_body[channel_start..]
        .find("<item")
        .map_or(body.len(), |item_start| channel_start + item_start);
    let channel = &body[channel_start..channel_end];
    let lower_channel = &lower_body[channel_start..channel_end];
    let link_start = lower_channel.find("<link>")? + "<link>".len();
    let link_end = lower_channel[link_start..].find("</link>")? + link_start;
    let link = channel[link_start..link_end].trim();
    (!link.is_empty()).then(|| link.to_string())
}
