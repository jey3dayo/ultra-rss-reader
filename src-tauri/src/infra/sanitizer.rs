pub const SANITIZER_VERSION: u32 = 1;

pub fn sanitize_html(raw: &str) -> String {
    ammonia::Builder::default()
        .add_tags(&[
            "img",
            "figure",
            "figcaption",
            "video",
            "source",
            "blockquote",
            "pre",
            "code",
        ])
        .add_tag_attributes("img", &["src", "alt", "width", "height"])
        .add_tag_attributes("video", &["src", "controls", "width", "height"])
        .add_tag_attributes("source", &["src", "type"])
        .url_schemes(std::collections::HashSet::from(["http", "https"]))
        .clean(raw)
        .to_string()
}

pub fn extract_visible_text(raw: &str) -> String {
    if raw.trim().is_empty() {
        return String::new();
    }

    use kuchikiki::traits::TendrilSink;

    let document = kuchikiki::parse_html().one(raw).document_node;
    document
        .text_contents()
        .split_whitespace()
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
}
