use crate::commands::dto::{DevRuntimeOptionsDto, PlatformInfoDto};

const DEV_INTENT_ENV_KEYS: [&str; 2] = ["VITE_DEV_INTENT", "VITE_ULTRA_RSS_DEV_INTENT"];
const DEV_WEB_URL_ENV_KEYS: [&str; 2] = ["VITE_DEV_WEB_URL", "VITE_ULTRA_RSS_DEV_WEB_URL"];
const DEV_WINDOW_WIDTH_ENV_KEYS: [&str; 1] = ["VITE_DEV_WINDOW_WIDTH"];
const DEV_WINDOW_HEIGHT_ENV_KEYS: [&str; 1] = ["VITE_DEV_WINDOW_HEIGHT"];

fn read_first_non_empty_env(keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        std::env::var(key)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn parse_optional_positive_u32(value: Option<String>) -> Option<u32> {
    value
        .and_then(|raw| raw.parse::<u32>().ok())
        .filter(|value| *value > 0)
}

#[tauri::command]
pub fn get_platform_info() -> PlatformInfoDto {
    PlatformInfoDto::from(crate::platform::PlatformInfo::current())
}

#[tauri::command]
pub fn get_dev_runtime_options() -> DevRuntimeOptionsDto {
    DevRuntimeOptionsDto {
        dev_intent: read_first_non_empty_env(&DEV_INTENT_ENV_KEYS),
        dev_web_url: read_first_non_empty_env(&DEV_WEB_URL_ENV_KEYS),
        dev_window_width: parse_optional_positive_u32(read_first_non_empty_env(
            &DEV_WINDOW_WIDTH_ENV_KEYS,
        )),
        dev_window_height: parse_optional_positive_u32(read_first_non_empty_env(
            &DEV_WINDOW_HEIGHT_ENV_KEYS,
        )),
    }
}
