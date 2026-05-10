use crate::commands::dto::AppError;

#[cfg(any(target_os = "macos", test))]
const READING_LIST_URL_ERROR: &str =
    "Only http:// and https:// URLs without newlines are supported";
#[cfg(any(target_os = "macos", test))]
const READING_LIST_COMMAND_ERROR: &str =
    "Failed to add to Reading List. Please try again from Safari.";
const CLIPBOARD_TEXT_ERROR: &str = "Invalid clipboard text";
pub(crate) const CLIPBOARD_TEXT_MAX_CHARS: usize = 2048;

#[cfg(any(target_os = "macos", test))]
fn is_reading_list_url(url: &str) -> bool {
    if url.contains(['\n', '\r']) {
        return false;
    }

    match url.split_once("://") {
        Some((scheme, _)) => {
            scheme.eq_ignore_ascii_case("http") || scheme.eq_ignore_ascii_case("https")
        }
        None => false,
    }
}

#[cfg(any(target_os = "macos", test))]
fn applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(any(target_os = "macos", test))]
fn reading_list_script(url: &str) -> Result<String, AppError> {
    if !is_reading_list_url(url) {
        return Err(AppError::UserVisible {
            message: READING_LIST_URL_ERROR.to_string(),
        });
    }

    Ok(format!(
        r#"tell application "Safari" to add reading list item "{}""#,
        applescript_string(url)
    ))
}

fn validate_clipboard_text(text: &str) -> Result<(), AppError> {
    if text.trim().is_empty() || text.chars().count() > CLIPBOARD_TEXT_MAX_CHARS {
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
        is_reading_list_url, reading_list_command_error, reading_list_script,
        validate_clipboard_text, CLIPBOARD_TEXT_ERROR, CLIPBOARD_TEXT_MAX_CHARS,
        READING_LIST_COMMAND_ERROR, READING_LIST_URL_ERROR,
    };

    #[test]
    fn builds_reading_list_script_for_http_urls() {
        let script = reading_list_script("https://example.com/article?utm=reader").unwrap();

        assert_eq!(
            script,
            r#"tell application "Safari" to add reading list item "https://example.com/article?utm=reader""#
        );
        assert!(is_reading_list_url("http://example.com/article"));
        assert!(is_reading_list_url("https://example.com/article"));
    }

    #[test]
    fn accepts_mixed_case_http_schemes_for_reading_list_urls() {
        for url in [
            "HTTP://example.com/article",
            "HTTPS://example.com/article",
            "HtTp://example.com/article",
            "hTtPs://example.com/article",
        ] {
            assert!(is_reading_list_url(url));
            let script = reading_list_script(url).unwrap();

            assert_eq!(
                script,
                format!(r#"tell application "Safari" to add reading list item "{url}""#)
            );
        }
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
    fn preserves_very_long_reading_list_urls_inside_one_applescript_argument() {
        let long_url = format!("https://example.com/article?token={}", "x".repeat(4096));
        let script = reading_list_script(&long_url).unwrap();

        assert_eq!(
            script,
            format!(r#"tell application "Safari" to add reading list item "{long_url}""#)
        );
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
        assert!(!is_reading_list_url("https://example.com/a\nb"));
        assert!(!is_reading_list_url("https://example.com/a\rb"));
        assert!(!is_reading_list_url("mailto:hello@example.com"));
        assert!(!is_reading_list_url("file:///tmp/article.html"));
        assert!(!is_reading_list_url(""));
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
    fn validates_clipboard_text_before_native_write() {
        validate_clipboard_text("https://example.com/article").unwrap();
        validate_clipboard_text(&"x".repeat(CLIPBOARD_TEXT_MAX_CHARS)).unwrap();

        for text in ["", "   ", "\n\t"] {
            let error = validate_clipboard_text(text).unwrap_err();

            assert_eq!(error.to_string(), CLIPBOARD_TEXT_ERROR);
        }

        let error = validate_clipboard_text(&"x".repeat(CLIPBOARD_TEXT_MAX_CHARS + 1)).unwrap_err();

        assert_eq!(error.to_string(), CLIPBOARD_TEXT_ERROR);
    }
}
