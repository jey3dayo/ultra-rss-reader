use std::path::Path;

pub(super) fn redacted_dev_store_path(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("<dev-store-path>")
        .to_string()
}

pub(super) fn redact_diagnostic_text(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return "<empty>".to_string();
    }
    trimmed
        .chars()
        .map(|c| match c {
            '\n' | '\r' | '\t' => ' ',
            '/' | '\\' => '?',
            c if c.is_ascii_graphic() || c == ' ' => c,
            _ => '?',
        })
        .collect()
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn redact_stderr_text(value: &str) -> String {
    format!("<redacted stderr bytes={}>", value.len())
}
