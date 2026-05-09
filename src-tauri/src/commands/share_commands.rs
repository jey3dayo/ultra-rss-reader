use crate::commands::dto::AppError;

const READING_LIST_URL_ERROR: &str =
    "Only http:// and https:// URLs without newlines are supported";

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

fn applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

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

#[tauri::command]
pub async fn copy_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), AppError> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
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
        return Err(AppError::UserVisible {
            message: format!("Failed to add to Reading List: {stderr}"),
        });
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
    use super::{is_reading_list_url, reading_list_script, READING_LIST_URL_ERROR};

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
}
