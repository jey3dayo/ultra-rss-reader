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
}
