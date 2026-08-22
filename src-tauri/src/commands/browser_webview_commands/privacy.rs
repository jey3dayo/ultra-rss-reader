//! Redacts credentials, query/fragment data, and opaque/sensitive-looking path segments
//! (tokens, signed URL segments, UUIDs, etc.) from embedded-browser URLs before they are
//! written to logs or diagnostics. See `docs/feed-content-privacy.md`.

use tauri::Url;

const OPAQUE_BROWSER_WEBVIEW_PATH_SEGMENT_MIN_LEN: usize = 24;

fn is_uuid_like_browser_webview_path_segment(segment: &str) -> bool {
    let bytes = segment.as_bytes();
    if bytes.len() != 36 {
        return false;
    }

    bytes.iter().enumerate().all(|(index, byte)| match index {
        8 | 13 | 18 | 23 => *byte == b'-',
        _ => byte.is_ascii_hexdigit(),
    })
}

fn is_opaque_browser_webview_path_segment(segment: &str) -> bool {
    segment.len() >= OPAQUE_BROWSER_WEBVIEW_PATH_SEGMENT_MIN_LEN
        && segment.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'=')
        })
        && segment.bytes().any(|byte| byte.is_ascii_alphabetic())
        && segment.bytes().any(|byte| byte.is_ascii_digit())
}

fn is_sensitive_browser_webview_path_segment(segment: &str) -> bool {
    let normalized = segment.to_ascii_lowercase();
    normalized.contains("token")
        || normalized.contains("secret")
        || normalized.contains("password")
        || normalized.contains("credential")
        || normalized.contains("private-key")
        || normalized.contains("private_key")
        || normalized.contains("apikey")
        || normalized.contains("api-key")
        || normalized.contains("api_key")
        || normalized.contains("signature")
        || normalized.contains("signed")
        || is_uuid_like_browser_webview_path_segment(segment)
        || is_opaque_browser_webview_path_segment(segment)
}

pub(super) fn browser_webview_log_url(url: &str) -> String {
    match Url::parse(url) {
        Ok(mut parsed) => {
            let _ = parsed.set_username("");
            let _ = parsed.set_password(None);
            if parsed.path_segments().is_some_and(|segments| {
                segments
                    .into_iter()
                    .any(is_sensitive_browser_webview_path_segment)
            }) {
                parsed.set_path("/redacted");
            }
            parsed.set_query(None);
            parsed.set_fragment(None);
            parsed.to_string()
        }
        Err(_) => "<invalid-url>".to_string(),
    }
}
