use std::borrow::Cow;

pub const SANITIZER_VERSION: u32 = 1;

pub fn sanitize_html(raw: &str) -> String {
    if raw.trim().is_empty() {
        return String::new();
    }

    ammonia::Builder::default()
        .add_tags(&[
            "img",
            "picture",
            "figure",
            "figcaption",
            "video",
            "source",
            "blockquote",
            "pre",
            "code",
        ])
        .add_tag_attributes("img", &["src", "srcset", "sizes", "alt", "width", "height"])
        .add_tag_attributes("video", &["src", "controls", "width", "height"])
        .add_tag_attributes("source", &["src", "srcset", "sizes", "type", "media"])
        .url_schemes(std::collections::HashSet::from(["http", "https"]))
        .attribute_filter(|_, attribute, value| {
            if attribute.eq_ignore_ascii_case("srcset") {
                return filter_srcset(value).map(Cow::Owned);
            }

            Some(Cow::Borrowed(value))
        })
        .clean(raw)
        .to_string()
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

    if let Some(scheme) = url_scheme(trimmed) {
        return scheme == "http" || scheme == "https";
    }

    true
}

fn url_scheme(url: &str) -> Option<String> {
    let scheme_end = url.find([':', '/', '?', '#'])?;
    (url.as_bytes()[scheme_end] == b':').then(|| url[..scheme_end].to_ascii_lowercase())
}

pub fn extract_visible_text(raw: &str) -> String {
    if raw.trim().is_empty() {
        return String::new();
    }

    use kuchikiki::traits::{NodeIterator, TendrilSink};

    let document = kuchikiki::parse_html().one(raw).document_node;
    document
        .inclusive_descendants()
        .text_nodes()
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
mod tests {
    use super::*;

    #[test]
    fn strips_script_tags() {
        let input = "<p>Hello</p><script>alert('xss')</script>";
        let output = sanitize_html(input);
        assert!(!output.contains("script"));
        assert!(output.contains("Hello"));
    }

    #[test]
    fn preserves_images() {
        let input = r#"<img src="https://example.com/img.jpg" alt="test">"#;
        let output = sanitize_html(input);
        assert!(output.contains("img"));
        assert!(output.contains("https://example.com/img.jpg"));
    }

    #[test]
    fn preserves_responsive_picture_sources_and_image_attributes() {
        let input = r#"
            <picture>
              <source
                media="(min-width: 800px)"
                type="image/webp"
                srcset="https://example.com/hero-800.webp 800w, https://example.com/hero-1200.webp 1200w"
                sizes="(min-width: 800px) 800px, 100vw"
                onerror="evil()">
              <img
                src="https://example.com/hero.jpg"
                srcset="https://example.com/hero-400.jpg 400w, https://example.com/hero-800.jpg 800w"
                sizes="100vw"
                alt="Hero"
                width="800"
                height="450"
                loading="lazy"
                decoding="async"
                onload="evil()">
            </picture>
        "#;

        let output = sanitize_html(input);

        assert!(output.contains("<picture>"));
        assert!(output.contains("<source"));
        assert!(output.contains(r#"media="(min-width: 800px)""#));
        assert!(output.contains(r#"type="image/webp""#));
        assert!(output.contains(r#"srcset="https://example.com/hero-800.webp 800w, https://example.com/hero-1200.webp 1200w""#));
        assert!(output.contains(r#"sizes="(min-width: 800px) 800px, 100vw""#));
        assert!(output.contains(r#"src="https://example.com/hero.jpg""#));
        assert!(output.contains(r#"srcset="https://example.com/hero-400.jpg 400w, https://example.com/hero-800.jpg 800w""#));
        assert!(output.contains(r#"sizes="100vw""#));
        assert!(output.contains(r#"alt="Hero""#));
        assert!(output.contains(r#"width="800""#));
        assert!(output.contains(r#"height="450""#));
        assert!(!output.contains("loading="));
        assert!(!output.contains("decoding="));
        assert!(!output.contains("onerror"));
        assert!(!output.contains("onload"));
    }

    #[test]
    fn filters_unsafe_srcset_candidates_while_retaining_safe_urls() {
        let input = r#"
            <picture>
              <source srcset="https://example.com/hero.webp 1x, javascript:alert(1) 2x, data:image/svg+xml,evil 3x">
              <img
                src="https://example.com/hero.jpg"
                srcset="http://example.com/hero-small.jpg 400w, images/hero-medium.jpg 600w, HTTPS://example.com/hero-large.jpg 800w, vbscript:evil 1200w"
                alt="Hero">
            </picture>
        "#;

        let output = sanitize_html(input);

        assert!(
            output.contains(r#"srcset="https://example.com/hero.webp 1x""#),
            "safe source srcset candidate should be retained: {output}",
        );
        assert!(
            output.contains(
                r#"srcset="http://example.com/hero-small.jpg 400w, images/hero-medium.jpg 600w, HTTPS://example.com/hero-large.jpg 800w""#
            ),
            "safe http/https and relative srcset candidates should be retained: {output}",
        );
        assert!(!output.contains("javascript:"));
        assert!(!output.contains("vbscript:"));
        assert!(!output.contains("data:image"));
        assert!(!output.contains("evil 3x"));
    }

    #[test]
    fn strips_onclick() {
        let input = r#"<div onclick="evil()">Click</div>"#;
        let output = sanitize_html(input);
        assert!(!output.contains("onclick"));
    }

    #[test]
    fn preserves_code_blocks() {
        let input = "<pre><code>fn main() {}</code></pre>";
        let output = sanitize_html(input);
        assert!(output.contains("<pre>"));
        assert!(output.contains("<code>"));
    }

    #[test]
    fn extract_visible_text_ignores_attributes() {
        let input = r#"<p><a href="https://example.com/kindle">Visible</a> text</p>"#;
        let output = extract_visible_text(input);
        assert_eq!(output, "Visible text");
    }

    #[test]
    fn extract_visible_text_keeps_inline_word_boundaries() {
        let input = "<p>Kindle <strong>Unlimited</strong></p>";
        let output = extract_visible_text(input);
        assert_eq!(output, "Kindle Unlimited");
    }

    #[test]
    fn sanitizer_boundary_removes_script_style_and_event_handlers() {
        let input = r#"<article><p onclick="evil()">Hello</p><script>alert(1)</script><style>.x{}</style></article>"#;
        let output = sanitize_html(input);

        assert!(output.contains("Hello"));
        assert!(!output.contains("onclick"));
        assert!(!output.contains("script"));
        assert!(!output.contains("style"));
        assert_eq!(extract_visible_text(&output), "Hello");
    }

    #[test]
    fn sanitizer_boundary_handles_empty_and_malformed_content() {
        assert_eq!(sanitize_html("   "), "");
        assert_eq!(extract_visible_text("   "), "");

        let output = sanitize_html("<p>Hello <strong>world</p>");

        assert!(output.contains("Hello"));
        assert!(output.contains("world"));
        assert_eq!(extract_visible_text(&output), "Hello world");
    }

    #[test]
    fn extract_visible_text_handles_malformed_html_fallback() {
        let output = extract_visible_text("<article><p>Lead <strong>body</article>Trailing");

        assert_eq!(output, "Lead body Trailing");
    }

    #[test]
    fn article_content_sanitizer_fixtures_cover_saved_and_new_article_inputs() {
        let fixtures = [
            (
                "saved article raw html",
                r#"<article><h1>Title</h1><p onclick="evil()">Saved <strong>body</strong></p><script>alert(1)</script></article>"#,
                "Title Saved body",
            ),
            (
                "new article feed html",
                r#"<div><p>New <em>entry</em></p><img src="https://example.com/image.jpg" alt="Hero"></div>"#,
                "New entry",
            ),
            ("empty article body", "   ", ""),
        ];

        for (label, raw, expected_text) in fixtures {
            let sanitized = sanitize_html(raw);

            assert!(
                !sanitized.contains("onclick"),
                "{label} should strip event handlers"
            );
            assert!(
                !sanitized.contains("<script"),
                "{label} should strip script tags"
            );
            assert_eq!(extract_visible_text(&sanitized), expected_text, "{label}");
        }
    }

    #[test]
    fn malformed_article_html_sanitizes_before_text_extraction() {
        let sanitized = sanitize_html("<article><p>Lead <strong>body</article>Trailing");

        assert!(sanitized.contains("Lead"));
        assert!(sanitized.contains("body"));
        assert_eq!(extract_visible_text(&sanitized), "Lead body Trailing");
    }
}
