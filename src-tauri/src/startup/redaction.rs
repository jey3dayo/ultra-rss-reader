use std::any::Any;
#[cfg(not(test))]
use std::panic::PanicHookInfo;

pub(crate) fn redacted_path_label(path: &std::path::Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| format!("[redacted parent]/{name}"))
        .unwrap_or_else(|| "[redacted path]".to_string())
}

pub(crate) fn redact_sensitive_url_token(token: &str) -> String {
    let trimmed_start = token.trim_start_matches(['"', '\'', '(', '[']);
    let prefix_len = token.len() - trimmed_start.len();
    let trimmed = trimmed_start.trim_end_matches([
        '"', '\'', ')', ']', ',', '.', ';', ':', '。', '、', '，', '．', '！', '？',
    ]);
    let suffix_len = trimmed_start.len() - trimmed.len();

    let Ok(mut url) = reqwest::Url::parse(trimmed) else {
        return token.to_string();
    };

    if url.scheme() != "http" && url.scheme() != "https" {
        return token.to_string();
    }

    if !url.username().is_empty() || url.password().is_some() {
        let _ = url.set_username("");
        let _ = url.set_password(None);
    }
    url.set_query(url.query().map(|_| "redacted"));
    if url.fragment().is_some() {
        url.set_fragment(Some("redacted"));
    }

    format!(
        "{}{}{}",
        &token[..prefix_len],
        url,
        &token[token.len() - suffix_len..]
    )
}

pub(crate) fn redact_sensitive_path_token(token: &str) -> String {
    let trimmed_start = token.trim_start_matches(['"', '\'', '(', '[']);
    let prefix_len = token.len() - trimmed_start.len();
    let trimmed = trimmed_start.trim_end_matches(['"', '\'', ')', ']', ',', '.', ';', ':', '。']);
    let suffix_len = trimmed_start.len() - trimmed.len();

    if !(trimmed.starts_with('/') || trimmed.starts_with("~/") || trimmed.contains(":\\"))
        || trimmed.len() <= 1
    {
        return token.to_string();
    }

    format!(
        "{}{}{}",
        &token[..prefix_len],
        redacted_path_label(std::path::Path::new(trimmed)),
        &token[token.len() - suffix_len..]
    )
}

pub(crate) fn redact_sensitive_panic_text(message: &str) -> String {
    let mut redact_next_account_value = false;

    message
        .split_whitespace()
        .map(redact_sensitive_url_token)
        .map(|token| redact_sensitive_path_token(&token))
        .map(|token| {
            if redact_next_account_value {
                redact_next_account_value = false;
                "[redacted account]".to_string()
            } else {
                let normalized = token.trim_end_matches(':').to_ascii_lowercase();
                redact_next_account_value = normalized == "account" || normalized == "account_name";
                token
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn panic_payload_text(payload: &(dyn Any + Send)) -> String {
    if let Some(message) = payload.downcast_ref::<&str>() {
        (*message).to_string()
    } else if let Some(message) = payload.downcast_ref::<String>() {
        message.clone()
    } else {
        "[non-string panic payload]".to_string()
    }
}

#[cfg(not(test))]
pub(crate) fn redacted_panic_hook_message(info: &PanicHookInfo<'_>) -> String {
    let message = redact_sensitive_panic_text(&panic_payload_text(info.payload()));
    match info.location() {
        Some(location) => format!(
            "Rust panic captured at {}:{}: {message}",
            location.file(),
            location.line()
        ),
        None => format!("Rust panic captured: {message}"),
    }
}

#[cfg(not(test))]
pub(crate) fn install_redacting_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let message = redacted_panic_hook_message(info);
        tracing::error!("{message}");
        eprintln!("{message}");
    }));
}
