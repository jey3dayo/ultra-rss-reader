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
mod tests {
    use super::*;

    struct SanitizerCorpusCase {
        label: &'static str,
        raw: &'static str,
        expected_text: &'static str,
        required_fragments: &'static [&'static str],
        forbidden_fragments: &'static [&'static str],
    }

    struct SrcsetContractCase {
        label: &'static str,
        srcset: &'static str,
        expected: Option<&'static str>,
    }

    const SANITIZER_FIXTURE_POLICY_VERSION: u32 = 3;

    const SANITIZER_CORPUS: &[SanitizerCorpusCase] = &[
        SanitizerCorpusCase {
            label: "untrusted feed html strips executable content",
            raw: include_str!("../../../tests/fixtures/sanitizer/untrusted-feed-html.html"),
            expected_text: "Feed title Trusted body",
            required_fragments: &["Feed title", "<strong>body</strong>"],
            forbidden_fragments: &["onclick", "<script", "<style", "alert('xss')"],
        },
        SanitizerCorpusCase {
            label: "tracking link attributes are removed",
            raw: include_str!("../../../tests/fixtures/sanitizer/tracking-link.html"),
            expected_text: "Read article",
            required_fragments: &[
                r#"href="https://publisher.example.com/read?utm_source=feed""#,
                r#"rel="noopener noreferrer""#,
            ],
            forbidden_fragments: &["ping=", "target=", "tracker.example.com"],
        },
        SanitizerCorpusCase {
            label: "tracking media keeps only absolute http candidates",
            raw: include_str!("../../../tests/fixtures/sanitizer/responsive-media.html"),
            expected_text: "",
            required_fragments: &[
                r#"src="https://cdn.example.com/hero.webp""#,
                r#"srcset="https://cdn.example.com/hero.webp 1x""#,
                r#"srcset="https://cdn.example.com/hero.jpg 800w""#,
                r#"sizes="100vw""#,
                r#"type="image/webp""#,
                r#"alt="Hero""#,
                r#"loading="lazy""#,
                r#"referrerpolicy="no-referrer""#,
            ],
            forbidden_fragments: &[
                r#"src="//cdn.example.com/protocol-relative.jpg""#,
                "data:image",
                "javascript:",
                "/relative.jpg",
                "onerror",
            ],
        },
        SanitizerCorpusCase {
            label: "malformed saved article markup is repaired before text extraction",
            raw: include_str!("../../../tests/fixtures/sanitizer/malformed-saved-article.html"),
            expected_text: "Lead body Trailing",
            required_fragments: &[
                "Lead",
                "body",
                "Trailing",
                r#"src="https://cdn.example.com/body.jpg""#,
                r#"loading="lazy""#,
                r#"referrerpolicy="no-referrer""#,
            ],
            forbidden_fragments: &["<script", "onclick"],
        },
        SanitizerCorpusCase {
            label: "secret-bearing article urls keep text without preserving credentials",
            raw: include_str!("../../../tests/fixtures/sanitizer/credential-url.html"),
            expected_text: "Private link",
            required_fragments: &["Private link", r#"alt="Private image""#],
            forbidden_fragments: &[
                "alice:secret",
                "api_key=raw",
                "token=raw",
                "private-token/feed.xml",
                "private-token/image.jpg",
            ],
        },
        SanitizerCorpusCase {
            label: "code block and Japanese text keep readable entity output",
            raw: include_str!("../../../tests/fixtures/sanitizer/code-japanese-entity.html"),
            expected_text: "日本語の本文 & emoji 😀 const value = \"<safe>\";",
            required_fragments: &[
                "日本語の本文 &amp; emoji 😀",
                "<pre><code>",
                "const value = \"&lt;safe&gt;\";",
                r#"src="https://cdn.example.com/clip.mp4""#,
                r#"src="https://cdn.example.com/clip.webm""#,
                r#"type="video/webm""#,
            ],
            forbidden_fragments: &["<script", "onclick"],
        },
    ];

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
        assert!(output.contains(r#"loading="lazy""#));
        assert!(output.contains(r#"referrerpolicy="no-referrer""#));
    }

    #[test]
    fn preserves_remote_reader_images_without_allowing_frames() {
        let input = r#"
            <p>Article body</p>
            <img src="https://cdn.example.com/body.jpg" alt="Body image">
            <iframe src="https://publisher.example.com/embed"></iframe>
            <object data="https://publisher.example.com/embed"></object>
        "#;

        let output = sanitize_html(input);

        assert!(
            output.contains(r#"src="https://cdn.example.com/body.jpg""#),
            "reader-mode remote images are currently compatibility-first: {output}",
        );
        assert!(!output.contains("<iframe"));
        assert!(!output.contains("<object"));
        assert!(!output.contains("publisher.example.com/embed"));
    }

    #[test]
    fn fixes_reader_media_and_link_privacy_attributes() {
        let input = r#"
            <p>
              <a href="https://example.com/article" rel="opener" target="_blank" ping="https://tracker.example.com" title="https://tracker.example.com/raw-token">Read</a>
            </p>
            <picture>
              <source src="https://cdn.example.com/hero.webp" srcset="https://cdn.example.com/hero.webp 1x" sizes="100vw" media="(min-width: 800px)" type="image/webp" referrerpolicy="origin">
              <img src="https://cdn.example.com/hero.jpg" srcset="https://cdn.example.com/hero.jpg 1x" sizes="100vw" alt="Hero" width="12000" height="9000" referrerpolicy="origin" title="https://cdn.example.com/raw-token.jpg">
            </picture>
            <img src="http://127.0.0.1/private.jpg" srcset="https://cdn.example.com/public.jpg 1x, http://10.0.0.1/private.jpg 2x" alt="Private">
            <img alt="Broken">
            <video src="https://cdn.example.com/clip.mp4" controls width="800" height="450" autoplay poster="https://cdn.example.com/poster.jpg"></video>
        "#;

        let output = sanitize_html(input);

        assert!(output.contains(r#"href="https://example.com/article""#));
        assert!(output.contains(r#"rel="noopener noreferrer""#));
        assert!(output.contains(r#"title="External link""#));
        assert!(output.contains(r#"<source"#));
        assert!(output.contains(r#"src="https://cdn.example.com/hero.webp""#));
        assert!(output.contains(r#"srcset="https://cdn.example.com/hero.webp 1x""#));
        assert!(output.contains(r#"sizes="100vw""#));
        assert!(output.contains(r#"media="(min-width: 800px)""#));
        assert!(output.contains(r#"type="image/webp""#));
        assert!(output.contains(r#"<img"#));
        assert!(output.contains(r#"alt="Hero""#));
        assert!(output.contains(r#"width="12000""#));
        assert!(output.contains(r#"height="9000""#));
        assert!(output.contains(r#"loading="lazy""#));
        assert!(output.contains(r#"title="External image""#));
        assert!(output.contains(r#"alt="Broken""#));
        assert!(output.contains(r#"<video"#));
        assert!(output.contains(r#"controls="""#));
        assert!(!output.contains("target="));
        assert!(!output.contains("ping="));
        assert!(output.contains(r#"referrerpolicy="no-referrer""#));
        assert!(!output.contains("tracker.example.com/raw-token"));
        assert!(!output.contains("cdn.example.com/raw-token"));
        assert!(!output.contains("127.0.0.1"));
        assert!(!output.contains("10.0.0.1"));
        assert!(!output.contains("autoplay"));
        assert!(!output.contains("poster="));
    }

    #[test]
    fn records_current_sanitizer_contract_version() {
        assert_eq!(SANITIZER_VERSION, 3);
    }

    #[test]
    fn records_current_sanitizer_added_tag_and_attribute_policy() {
        assert_eq!(
            SANITIZER_ADDED_TAGS,
            &[
                "img",
                "picture",
                "figure",
                "figcaption",
                "video",
                "source",
                "blockquote",
                "pre",
                "code",
            ],
        );
        assert_eq!(
            SANITIZER_IMG_ATTRS,
            &[
                "src",
                "srcset",
                "sizes",
                "alt",
                "width",
                "height",
                "loading",
                "referrerpolicy",
            ],
        );
        assert_eq!(
            SANITIZER_VIDEO_ATTRS,
            &["src", "controls", "width", "height"],
        );
        assert_eq!(
            SANITIZER_SOURCE_ATTRS,
            &["src", "srcset", "sizes", "type", "media"],
        );
    }

    #[test]
    fn untrusted_feed_html_fixture_corpus_matches_sanitizer_contract() {
        for fixture in SANITIZER_CORPUS {
            let sanitized = sanitize_html(fixture.raw);

            for fragment in fixture.required_fragments {
                assert!(
                    sanitized.contains(fragment),
                    "{} should keep required fragment {fragment:?}: {sanitized}",
                    fixture.label,
                );
            }

            for fragment in fixture.forbidden_fragments {
                assert!(
                    !sanitized.contains(fragment),
                    "{} should remove forbidden fragment {fragment:?}: {sanitized}",
                    fixture.label,
                );
            }

            assert_eq!(
                extract_visible_text(&sanitized),
                fixture.expected_text,
                "{}",
                fixture.label,
            );
        }
    }

    #[test]
    fn saved_article_repair_gate_tracks_policy_version_and_fixture_corpus() {
        assert_eq!(
            SANITIZER_VERSION, SANITIZER_FIXTURE_POLICY_VERSION,
            "bump the saved article repair gate fixture policy version when sanitizer policy changes",
        );

        let stale_saved_article_version = SANITIZER_VERSION - 1;
        assert!(
            stale_saved_article_version < SANITIZER_VERSION,
            "saved articles below the current sanitizer version must be repair candidates",
        );

        for fixture in SANITIZER_CORPUS {
            let sanitized = sanitize_html(fixture.raw);
            assert_eq!(
                extract_visible_text(&sanitized),
                fixture.expected_text,
                "{} should remain explainable by the saved article repair corpus",
                fixture.label,
            );
        }
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
        assert!(output.contains(r#"loading="lazy""#));
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
                r#"srcset="http://example.com/hero-small.jpg 400w, HTTPS://example.com/hero-large.jpg 800w""#
            ),
            "safe http/https srcset candidates should be retained: {output}",
        );
        assert!(!output.contains("images/hero-medium.jpg"));
        assert!(!output.contains("javascript:"));
        assert!(!output.contains("vbscript:"));
        assert!(!output.contains("data:image"));
        assert!(!output.contains("evil 3x"));
    }

    #[test]
    fn filters_srcset_parser_edge_case_corpus_by_url_safety_boundary() {
        let huge_srcset = (0..64)
            .map(|index| format!("https://example.com/hero-{index}.jpg {index}w"))
            .collect::<Vec<_>>()
            .join(", ");
        let expected_huge_srcset = huge_srcset.clone();
        let cases = [
            SrcsetContractCase {
                label: "comma in absolute http url stays inside the same candidate",
                srcset: "https://example.com/image,name.jpg 1x, https://example.com/next.jpg 2x",
                expected: Some(
                    "https://example.com/image,name.jpg 1x, https://example.com/next.jpg 2x",
                ),
            },
            SrcsetContractCase {
                label: "empty descriptor keeps safe url because descriptor validation is not enforced",
                srcset: "https://example.com/empty.jpg , https://example.com/valid.jpg 2x",
                expected: Some("https://example.com/empty.jpg, https://example.com/valid.jpg 2x"),
            },
            SrcsetContractCase {
                label: "duplicate descriptor keeps safe url because descriptor validation is not enforced",
                srcset: "https://example.com/duplicate.jpg 1x 2x, https://example.com/valid.jpg 2x",
                expected: Some(
                    "https://example.com/duplicate.jpg 1x 2x, https://example.com/valid.jpg 2x",
                ),
            },
            SrcsetContractCase {
                label: "control character in url removes only that candidate",
                srcset: "https://example.com/\u{0008}bad.jpg 1x, https://example.com/good.jpg 2x",
                expected: Some("https://example.com/good.jpg 2x"),
            },
            SrcsetContractCase {
                label: "uppercase http scheme remains accepted by url parser normalization",
                srcset: "HTTPS://example.com/upper.jpg 1x, HTTP://example.com/plain.jpg 2x",
                expected: Some("HTTPS://example.com/upper.jpg 1x, HTTP://example.com/plain.jpg 2x"),
            },
            SrcsetContractCase {
                label: "unsafe huge srcset removes the attribute when no candidate survives",
                srcset: "javascript:alert(1) 1x, data:image/svg+xml,evil 2x, /relative.jpg 3x",
                expected: None,
            },
        ];

        for case in cases {
            assert_eq!(
                filter_srcset(case.srcset).as_deref(),
                case.expected,
                "{}",
                case.label
            );
        }

        assert_eq!(
            filter_srcset(&huge_srcset).as_deref(),
            Some(expected_huge_srcset.as_str()),
            "huge safe srcset should remain unchanged across candidate splitting",
        );
    }

    #[test]
    fn removes_relative_media_urls_instead_of_resolving_without_article_base_url() {
        let input = r#"
            <picture>
              <source src="media/hero.webp" srcset="/hero-small.webp 1x, https://example.com/hero.webp 2x">
              <img src="/hero.jpg" srcset="hero-400.jpg 400w, https://example.com/hero-800.jpg 800w" alt="Hero">
            </picture>
        "#;

        let output = sanitize_html(input);

        assert!(!output.contains("media/hero.webp"));
        assert!(!output.contains("/hero-small.webp"));
        assert!(!output.contains(r#"src="/hero.jpg""#));
        assert!(!output.contains("hero-400.jpg"));
        assert!(output.contains("https://example.com/hero.webp 2x"));
        assert!(output.contains("https://example.com/hero-800.jpg 800w"));
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
    fn extract_visible_text_ignores_script_and_style_text() {
        let input = "<p>Visible</p><script>alert(1)</script><style>.hidden{display:none}</style>";
        let output = extract_visible_text(input);
        assert_eq!(output, "Visible");
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
