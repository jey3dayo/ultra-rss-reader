use crate::commands::dto::AppError;
use crate::commands::dto::{
    DevRuntimeOptionsDto, PlatformInfoDto, PlatformPermissionDeniedRecoveryDto,
    PlatformPermissionDeniedSurfaceDto,
};

const DEV_INTENT_ENV_KEYS: [&str; 2] = ["VITE_DEV_INTENT", "VITE_ULTRA_RSS_DEV_INTENT"];
const DEV_WEB_URL_ENV_KEYS: [&str; 2] = ["VITE_DEV_WEB_URL", "VITE_ULTRA_RSS_DEV_WEB_URL"];
const DEV_WINDOW_WIDTH_ENV_KEYS: [&str; 1] = ["VITE_DEV_WINDOW_WIDTH"];
const DEV_WINDOW_HEIGHT_ENV_KEYS: [&str; 1] = ["VITE_DEV_WINDOW_HEIGHT"];
const MAX_DEV_WINDOW_DIMENSION_PX: u32 = 10_000;
const FILE_PERMISSION_DENIED_COPY: &str =
    "File access was denied. Choose a user-accessible folder and check OS privacy settings.";
const DIALOG_PERMISSION_DENIED_COPY: &str =
    "File dialog access was denied. Allow file dialog access in OS privacy settings and try again.";
const KEYRING_PERMISSION_DENIED_COPY: &str =
    "Credential storage access was denied. Unlock the OS keyring or allow Ultra RSS Reader access.";
const CLIPBOARD_PERMISSION_DENIED_COPY: &str =
    "Clipboard access was denied. Allow clipboard access for Ultra RSS Reader and try again.";

fn read_first_non_empty_env(keys: &[&'static str]) -> Option<String> {
    crate::platform::EnvSnapshot::capture(keys, |key| std::env::var(key).ok()).first_non_empty()
}

fn parse_optional_positive_u32(value: Option<String>) -> Option<u32> {
    value
        .and_then(|raw| raw.parse::<u32>().ok())
        .filter(|value| *value > 0 && *value <= MAX_DEV_WINDOW_DIMENSION_PX)
}

fn read_first_valid_dev_web_url(keys: &[&'static str]) -> Option<String> {
    crate::platform::EnvSnapshot::capture(keys, |key| std::env::var(key).ok())
        .first_valid(|value| crate::commands::parse_browser_http_url(value).is_ok())
}

#[tauri::command]
pub fn get_platform_info() -> PlatformInfoDto {
    PlatformInfoDto::from(crate::platform::PlatformInfo::current())
}

#[tauri::command]
pub fn get_dev_runtime_options() -> DevRuntimeOptionsDto {
    DevRuntimeOptionsDto {
        dev_intent: read_first_non_empty_env(&DEV_INTENT_ENV_KEYS),
        dev_web_url: read_first_valid_dev_web_url(&DEV_WEB_URL_ENV_KEYS),
        dev_window_width: parse_optional_positive_u32(read_first_non_empty_env(
            &DEV_WINDOW_WIDTH_ENV_KEYS,
        )),
        dev_window_height: parse_optional_positive_u32(read_first_non_empty_env(
            &DEV_WINDOW_HEIGHT_ENV_KEYS,
        )),
    }
}

fn platform_permission_denied_recovery_matrix() -> Vec<PlatformPermissionDeniedRecoveryDto> {
    vec![
        PlatformPermissionDeniedRecoveryDto {
            surface: PlatformPermissionDeniedSurfaceDto::File,
            user_action_copy: FILE_PERMISSION_DENIED_COPY.to_string(),
        },
        PlatformPermissionDeniedRecoveryDto {
            surface: PlatformPermissionDeniedSurfaceDto::Dialog,
            user_action_copy: DIALOG_PERMISSION_DENIED_COPY.to_string(),
        },
        PlatformPermissionDeniedRecoveryDto {
            surface: PlatformPermissionDeniedSurfaceDto::Keyring,
            user_action_copy: KEYRING_PERMISSION_DENIED_COPY.to_string(),
        },
        PlatformPermissionDeniedRecoveryDto {
            surface: PlatformPermissionDeniedSurfaceDto::Clipboard,
            user_action_copy: CLIPBOARD_PERMISSION_DENIED_COPY.to_string(),
        },
    ]
}

#[tauri::command]
pub fn get_platform_permission_denied_recovery() -> Vec<PlatformPermissionDeniedRecoveryDto> {
    platform_permission_denied_recovery_matrix()
}

#[tauri::command]
pub fn reset_oversized_dev_credentials_store() -> Result<bool, AppError> {
    crate::infra::keyring_store::reset_oversized_dev_credentials_store().map_err(AppError::from)
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
    fn dev_runtime_options_fall_back_to_alias_when_primary_intent_is_blank() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _primary = EnvVarGuard::set("VITE_DEV_INTENT", "   ");
        let _alias = EnvVarGuard::set("VITE_ULTRA_RSS_DEV_INTENT", " browser ");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_intent, Some("browser".to_string()));
    }

    #[test]
    fn dev_runtime_options_prefers_primary_intent_over_alias() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _primary = EnvVarGuard::set("VITE_DEV_INTENT", " open-web-preview-url ");
        let _alias = EnvVarGuard::set("VITE_ULTRA_RSS_DEV_INTENT", "open-settings-general");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_intent, Some("open-web-preview-url".to_string()));
    }

    #[test]
    fn dev_runtime_options_leaves_unknown_intent_for_frontend_parser_fallback() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _primary = EnvVarGuard::set("VITE_DEV_INTENT", "removed-dev-intent");
        let _alias = EnvVarGuard::set("VITE_ULTRA_RSS_DEV_INTENT", "open-settings-general");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_intent, Some("removed-dev-intent".to_string()));
    }

    #[test]
    fn dev_runtime_options_accept_http_dev_web_urls() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _primary = EnvVarGuard::set("VITE_DEV_WEB_URL", " https://example.com/preview ");
        let _alias = EnvVarGuard::remove("VITE_ULTRA_RSS_DEV_WEB_URL");

        let options = get_dev_runtime_options();

        assert_eq!(
            options.dev_web_url,
            Some("https://example.com/preview".to_string())
        );
    }

    #[test]
    fn dev_runtime_options_ignore_blank_or_non_http_dev_web_urls() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let cases = [
            "",
            "   ",
            "file:///tmp/article.html",
            "javascript:alert(1)",
            "mailto:test@example.com",
            "localhost:1420",
            "/relative/path",
        ];

        for value in cases {
            let _primary = EnvVarGuard::set("VITE_DEV_WEB_URL", value);
            let _alias = EnvVarGuard::remove("VITE_ULTRA_RSS_DEV_WEB_URL");

            let options = get_dev_runtime_options();

            assert_eq!(
                options.dev_web_url, None,
                "dev web URL value {value:?} should be ignored"
            );
        }
    }

    #[test]
    fn dev_runtime_options_fall_back_to_alias_when_primary_web_url_is_invalid() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _primary = EnvVarGuard::set("VITE_DEV_WEB_URL", "file:///tmp/article.html");
        let _alias = EnvVarGuard::set("VITE_ULTRA_RSS_DEV_WEB_URL", " http://localhost:1420 ");

        let options = get_dev_runtime_options();

        assert_eq!(
            options.dev_web_url,
            Some("http://localhost:1420".to_string())
        );
    }

    #[test]
    fn dev_runtime_options_accept_private_hosts_allowed_by_browser_url_schema() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let cases = [
            "http://localhost:1420/preview",
            "http://127.0.0.1:1420/preview",
            "http://[::1]:1420/preview",
        ];

        for value in cases {
            let _primary = EnvVarGuard::set("VITE_DEV_WEB_URL", value);
            let _alias = EnvVarGuard::remove("VITE_ULTRA_RSS_DEV_WEB_URL");

            let options = get_dev_runtime_options();

            assert_eq!(
                options.dev_web_url,
                Some(value.to_string()),
                "dev web URL private host {value:?} should be accepted"
            );
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
            ("   ", "\t"),
            ("0", "0"),
            (" -1 ", " -900 "),
            ("-1", "-900"),
            ("520.5", "900.1"),
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
    fn dev_runtime_options_keep_height_when_width_is_unset() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _width = EnvVarGuard::remove("VITE_DEV_WINDOW_WIDTH");
        let _height = EnvVarGuard::set("VITE_DEV_WINDOW_HEIGHT", "900");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_window_width, None);
        assert_eq!(options.dev_window_height, Some(900));
    }

    #[test]
    fn dev_runtime_options_ignore_window_env_above_max_dimension() {
        let _lock = ENV_LOCK.lock().expect("env lock poisoned");
        let _width = EnvVarGuard::set("VITE_DEV_WINDOW_WIDTH", "10001");
        let _height = EnvVarGuard::set("VITE_DEV_WINDOW_HEIGHT", "10000");

        let options = get_dev_runtime_options();

        assert_eq!(options.dev_window_width, None);
        assert_eq!(options.dev_window_height, Some(MAX_DEV_WINDOW_DIMENSION_PX));
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

    #[test]
    fn platform_permission_denied_recovery_copy_is_action_specific() {
        let recoveries = get_platform_permission_denied_recovery();
        let surfaces = recoveries
            .iter()
            .map(|recovery| recovery.surface.clone())
            .collect::<Vec<_>>();

        assert_eq!(
            surfaces,
            vec![
                PlatformPermissionDeniedSurfaceDto::File,
                PlatformPermissionDeniedSurfaceDto::Dialog,
                PlatformPermissionDeniedSurfaceDto::Keyring,
                PlatformPermissionDeniedSurfaceDto::Clipboard,
            ]
        );
        for recovery in recoveries {
            assert!(recovery.user_action_copy.contains("denied"));
            assert!(!recovery.user_action_copy.trim().is_empty());
        }
    }
}
