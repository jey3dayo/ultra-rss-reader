use crate::commands::dto::PlatformInfoDto;

#[tauri::command]
pub fn get_platform_info() -> PlatformInfoDto {
    PlatformInfoDto::from(crate::platform::PlatformInfo::current())
}
