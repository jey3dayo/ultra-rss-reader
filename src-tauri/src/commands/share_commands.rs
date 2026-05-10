use crate::commands::dto::AppError;

#[cfg(any(target_os = "macos", test))]
const READING_LIST_URL_ERROR: &str =
    "Only http:// and https:// URLs without newlines are supported";
#[cfg(any(target_os = "macos", test))]
const READING_LIST_COMMAND_ERROR: &str =
    "Failed to add to Reading List. Please try again from Safari.";
const CLIPBOARD_TEXT_ERROR: &str = "Invalid clipboard text";
pub(crate) const CLIPBOARD_TEXT_MAX_CHARS: usize = 2048;
pub(crate) const CLIPBOARD_TEXT_MAX_BYTES: usize = CLIPBOARD_TEXT_MAX_CHARS * 4;
#[cfg(any(target_os = "macos", test))]
pub(crate) const READING_LIST_URL_MAX_BYTES: usize = 16 * 1024;

#[cfg(any(target_os = "macos", test))]
fn normalize_reading_list_url(url: &str) -> Option<&str> {
    let trimmed = url.trim();
    let lower = trimmed.to_lowercase();
    let has_credentials = reqwest::Url::parse(trimmed)
        .map(|url| !url.username().is_empty() || url.password().is_some())
        .unwrap_or(false);
    if trimmed.len() > READING_LIST_URL_MAX_BYTES
        || trimmed.chars().any(char::is_control)
        || trimmed.chars().any(char::is_whitespace)
        || !(lower.starts_with("http://") || lower.starts_with("https://"))
        || has_credentials
    {
        return None;
    }

    Some(trimmed)
}

#[cfg(any(target_os = "macos", test))]
fn applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(any(target_os = "macos", test))]
fn reading_list_script(url: &str) -> Result<String, AppError> {
    let normalized_url = normalize_reading_list_url(url).ok_or_else(|| AppError::UserVisible {
        message: READING_LIST_URL_ERROR.to_string(),
    })?;

    Ok(format!(
        r#"tell application "Safari" to add reading list item "{}""#,
        applescript_string(normalized_url)
    ))
}

#[cfg(any(target_os = "macos", test))]
fn redacted_reading_list_diagnostic_text(value: &str) -> String {
    value
        .split_whitespace()
        .map(redacted_reading_list_diagnostic_token)
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(any(target_os = "macos", test))]
fn redacted_reading_list_diagnostic_token(token: &str) -> String {
    let trailing_punctuation = token
        .chars()
        .rev()
        .take_while(|c| matches!(c, ')' | ',' | '.' | ';' | '!' | '?'))
        .count();
    let (url_token, trailing) = token.split_at(token.len().saturating_sub(trailing_punctuation));

    match reqwest::Url::parse(url_token) {
        Ok(mut url) if url.scheme() == "http" || url.scheme() == "https" => {
            let _ = url.set_username("");
            let _ = url.set_password(None);
            if url.query().is_some() {
                url.set_query(Some("redacted"));
            }
            if url.fragment().is_some() {
                url.set_fragment(Some("redacted"));
            }
            format!("{url}{trailing}")
        }
        _ => token.to_string(),
    }
}

fn is_grapheme_extend_like(c: char) -> bool {
    matches!(
        c,
        '\u{0300}'..='\u{036f}'
            | '\u{1ab0}'..='\u{1aff}'
            | '\u{1dc0}'..='\u{1dff}'
            | '\u{20d0}'..='\u{20ff}'
            | '\u{fe00}'..='\u{fe0f}'
            | '\u{fe20}'..='\u{fe2f}'
            | '\u{1f3fb}'..='\u{1f3ff}'
    )
}

fn approximate_grapheme_count(value: &str) -> usize {
    let mut count = 0;
    let mut joins_next = false;

    for c in value.chars() {
        if c == '\u{200d}' {
            joins_next = count > 0;
            continue;
        }
        if joins_next || is_grapheme_extend_like(c) {
            joins_next = false;
            continue;
        }
        joins_next = false;
        count += 1;
    }

    count
}

fn validate_clipboard_text(text: &str) -> Result<(), AppError> {
    if text.trim().is_empty()
        || text.chars().any(char::is_control)
        || approximate_grapheme_count(text) > CLIPBOARD_TEXT_MAX_CHARS
        || text.len() > CLIPBOARD_TEXT_MAX_BYTES
    {
        return Err(AppError::UserVisible {
            message: CLIPBOARD_TEXT_ERROR.to_string(),
        });
    }

    Ok(())
}

#[cfg(any(target_os = "macos", test))]
fn reading_list_command_error() -> AppError {
    AppError::UserVisible {
        message: READING_LIST_COMMAND_ERROR.to_string(),
    }
}

#[tauri::command]
pub async fn copy_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), AppError> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    validate_clipboard_text(&text)?;
    app.clipboard()
        .write_text(&text)
        .map_err(|e| AppError::UserVisible {
            message: format!("Clipboard error: {e}"),
        })?;
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn add_to_reading_list(url: String) -> Result<(), AppError> {
    let script = reading_list_script(&url)?;
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to run osascript: {e}"),
        })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stderr = redacted_reading_list_diagnostic_text(&stderr);
        tracing::warn!(
            status = %output.status,
            stderr = %stderr,
            "failed to add URL to Safari Reading List"
        );
        return Err(reading_list_command_error());
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn add_to_reading_list(_url: String) -> Result<(), AppError> {
    Err(AppError::UserVisible {
        message: "Reading List is only available on macOS".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_reading_list_url, reading_list_command_error, reading_list_script,
        redacted_reading_list_diagnostic_text, validate_clipboard_text, CLIPBOARD_TEXT_ERROR,
        CLIPBOARD_TEXT_MAX_BYTES, CLIPBOARD_TEXT_MAX_CHARS, READING_LIST_COMMAND_ERROR,
        READING_LIST_URL_ERROR, READING_LIST_URL_MAX_BYTES,
    };

    #[test]
    fn builds_reading_list_script_for_http_urls() {
        let script = reading_list_script("https://example.com/article?utm=reader").unwrap();

        assert_eq!(
            script,
            r#"tell application "Safari" to add reading list item "https://example.com/article?utm=reader""#
        );
        assert!(normalize_reading_list_url("http://example.com/article").is_some());
        assert!(normalize_reading_list_url("https://example.com/article").is_some());
    }

    #[test]
    fn accepts_mixed_case_http_schemes_for_reading_list_urls() {
        for url in [
            "HTTP://example.com/article",
            "HTTPS://example.com/article",
            "HtTp://example.com/article",
            "hTtPs://example.com/article",
        ] {
            assert!(normalize_reading_list_url(url).is_some());
            let script = reading_list_script(url).unwrap();

            assert_eq!(
                script,
                format!(r#"tell application "Safari" to add reading list item "{url}""#)
            );
        }
    }

    #[test]
    fn trims_reading_list_urls_like_frontend_http_command_normalization() {
        let script = reading_list_script(" https://example.com/article ").unwrap();

        assert_eq!(
            script,
            r#"tell application "Safari" to add reading list item "https://example.com/article""#
        );
        assert_eq!(
            normalize_reading_list_url(" http://example.com/article "),
            Some("http://example.com/article")
        );
    }

    #[test]
    fn escapes_quotes_and_backslashes_in_reading_list_script() {
        let script = reading_list_script(r#"https://example.com/a"b\c"#).unwrap();

        assert_eq!(
            script,
            r#"tell application "Safari" to add reading list item "https://example.com/a\"b\\c""#
        );
    }

    #[test]
    fn preserves_reading_list_urls_up_to_the_16kb_applescript_argument_limit() {
        let long_url = format!("https://example.com/article?token={}", "x".repeat(4096));
        let script = reading_list_script(&long_url).unwrap();

        assert_eq!(
            script,
            format!(r#"tell application "Safari" to add reading list item "{long_url}""#)
        );

        let max_url = format!(
            "https://example.com/article?token={}",
            "x".repeat(READING_LIST_URL_MAX_BYTES - "https://example.com/article?token=".len())
        );
        let script = reading_list_script(&max_url).unwrap();
        assert_eq!(
            script,
            format!(r#"tell application "Safari" to add reading list item "{max_url}""#)
        );
    }

    #[test]
    fn rejects_reading_list_urls_over_the_16kb_applescript_argument_limit() {
        let long_url = format!(
            "https://example.com/article?token={}",
            "x".repeat(READING_LIST_URL_MAX_BYTES - "https://example.com/article?token=".len() + 1)
        );
        let error = reading_list_script(&long_url).unwrap_err();

        assert_eq!(error.to_string(), READING_LIST_URL_ERROR);
    }

    #[test]
    fn escapes_url_double_quotes_without_closing_reading_list_string() {
        let script = reading_list_script(r#"https://example.com/search?q="quoted""#).unwrap();

        assert_eq!(
            script,
            r#"tell application "Safari" to add reading list item "https://example.com/search?q=\"quoted\"""#
        );
        assert!(!script.contains(r#"q="quoted""#));
    }

    #[test]
    fn rejects_newline_and_non_http_reading_list_urls() {
        assert!(normalize_reading_list_url("https://example.com/a\nb").is_none());
        assert!(normalize_reading_list_url("https://example.com/a\rb").is_none());
        assert!(normalize_reading_list_url("mailto:hello@example.com").is_none());
        assert!(normalize_reading_list_url("file:///tmp/article.html").is_none());
        assert!(normalize_reading_list_url("").is_none());
    }

    #[test]
    fn rejects_reading_list_urls_with_control_whitespace_or_credentials() {
        for url in [
            "https://example.com/a\tb",
            "https://example.com/a\u{0000}b",
            "https://user@example.com/article",
            "https://user:pass@example.com/article",
            "https://example.com/a b",
        ] {
            let error = reading_list_script(url).unwrap_err();

            assert_eq!(error.to_string(), READING_LIST_URL_ERROR);
        }
    }

    #[test]
    fn rejects_unsupported_schemes_before_building_reading_list_script() {
        for url in [
            "mailto:hello@example.com",
            "file:///tmp/article.html",
            "ftp://example.com/feed.xml",
        ] {
            let error = reading_list_script(url).unwrap_err();

            assert_eq!(error.to_string(), READING_LIST_URL_ERROR);
        }
    }

    #[test]
    fn rejects_empty_and_multiline_reading_list_urls() {
        for url in ["", "https://example.com/a\nb", "https://example.com/a\rb"] {
            let error = reading_list_script(url).unwrap_err();

            assert_eq!(error.to_string(), READING_LIST_URL_ERROR);
        }
    }

    #[test]
    fn hides_applescript_stderr_from_reading_list_user_visible_errors() {
        let error = reading_list_command_error();

        assert_eq!(error.to_string(), READING_LIST_COMMAND_ERROR);
        assert!(!error.to_string().contains("osascript"));
        assert!(!error.to_string().contains("https://example.com/private"));
    }

    #[test]
    fn redacts_reading_list_diagnostic_stderr_url_tokens() {
        let message = redacted_reading_list_diagnostic_text(
            "osascript failed for https://user:pass@example.com/private?token=raw#frag.",
        );

        assert_eq!(
            message,
            "osascript failed for https://example.com/private?redacted#redacted."
        );
        assert!(!message.contains("user"));
        assert!(!message.contains("pass"));
        assert!(!message.contains("token=raw"));
        assert!(!message.contains("#frag"));
    }

    #[test]
    fn validates_clipboard_text_before_native_write() {
        validate_clipboard_text("https://example.com/article").unwrap();
        validate_clipboard_text(&"x".repeat(CLIPBOARD_TEXT_MAX_CHARS)).unwrap();
        validate_clipboard_text(&"🙂".repeat(CLIPBOARD_TEXT_MAX_CHARS)).unwrap();
        validate_clipboard_text(&format!("e{}", "\u{0301}".repeat(16))).unwrap();
        validate_clipboard_text("👨‍👩‍👧‍👦").unwrap();

        for text in [
            "",
            "   ",
            "\n\t",
            "hello\u{0000}",
            "hello\tworld",
            "hello\nworld",
        ] {
            let error = validate_clipboard_text(text).unwrap_err();

            assert_eq!(error.to_string(), CLIPBOARD_TEXT_ERROR);
        }

        let error = validate_clipboard_text(&"x".repeat(CLIPBOARD_TEXT_MAX_CHARS + 1)).unwrap_err();

        assert_eq!(error.to_string(), CLIPBOARD_TEXT_ERROR);

        let error = validate_clipboard_text(&format!(
            "e{}",
            "\u{0301}".repeat(CLIPBOARD_TEXT_MAX_BYTES / 2 + 1)
        ))
        .unwrap_err();

        assert_eq!(error.to_string(), CLIPBOARD_TEXT_ERROR);
    }
}
