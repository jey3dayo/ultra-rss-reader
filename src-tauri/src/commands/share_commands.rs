use crate::commands::dto::AppError;

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
    let escaped_url = url.replace('\\', "\\\\").replace('"', "\" & quote & \"");
    let script =
        format!(r#"tell application "Safari" to add reading list item ("{escaped_url}")"#,);
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
