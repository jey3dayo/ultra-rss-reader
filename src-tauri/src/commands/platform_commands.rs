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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct EnvVarGuard {
        key: &'static str,
        previous: Option<String>,
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: &str) -> Self {
            let previous = std::env::var(key).ok();
            std::env::set_var(key, value);
            Self { key, previous }
        }

        fn remove(key: &'static str) -> Self {
            let previous = std::env::var(key).ok();
            std::env::remove_var(key);
            Self { key, previous }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            if let Some(previous) = &self.previous {
                std::env::set_var(self.key, previous);
            } else {
                std::env::remove_var(self.key);
            }
        }
    }

    #[test]
    fn dev_runtime_options_include_positive_integer_window_env() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _width = EnvVarGuard::set("VITE_DEV_WINDOW_WIDTH", " 520 ");
        let _height = EnvVarGuard::set("VITE_DEV_WINDOW_HEIGHT", "900");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_window_width, Some(520));
        assert_eq!(options.dev_window_height, Some(900));
    }

    #[test]
    fn dev_runtime_options_ignore_non_positive_or_invalid_window_env() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let cases = [
            ("", ""),
            ("0", "0"),
            ("-1", "-900"),
            ("wide", "tall"),
            ("520px", "900px"),
        ];

        for (width, height) in cases {
            let _width = EnvVarGuard::set("VITE_DEV_WINDOW_WIDTH", width);
            let _height = EnvVarGuard::set("VITE_DEV_WINDOW_HEIGHT", height);

            let options = get_dev_runtime_options();

            assert_eq!(
                options.dev_window_width, None,
                "width value {width:?} should be ignored"
            );
            assert_eq!(
                options.dev_window_height, None,
                "height value {height:?} should be ignored"
            );
        }
    }

    #[test]
    fn dev_runtime_options_keep_positive_window_side_when_other_side_is_invalid() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _width = EnvVarGuard::set("VITE_DEV_WINDOW_WIDTH", "640");
        let _height = EnvVarGuard::set("VITE_DEV_WINDOW_HEIGHT", "tall");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_window_width, Some(640));
        assert_eq!(options.dev_window_height, None);
    }

    #[test]
    fn dev_runtime_options_omit_unset_window_env() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _width = EnvVarGuard::remove("VITE_DEV_WINDOW_WIDTH");
        let _height = EnvVarGuard::remove("VITE_DEV_WINDOW_HEIGHT");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_window_width, None);
        assert_eq!(options.dev_window_height, None);
    }
}
