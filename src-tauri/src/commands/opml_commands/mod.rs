mod export;
mod import;

pub use export::{
    __cmd__export_opml_to_file, __tauri_command_name_export_opml_to_file, export_opml_to_file,
};
pub use import::{__cmd__import_opml, __tauri_command_name_import_opml, import_opml};

// Keep this contract in the facade because the command-args validation test scans this source path.
pub(crate) const OPML_IMPORT_CONTENT_MAX_BYTES: usize = 4096 * 1024;

#[cfg(test)]
pub(crate) use export::{
    build_export_opml_feeds, ensure_opml_extension, export_opml_to_file_in_db,
    opml_export_temp_path, opml_generate_log_error_for_test, validate_opml_export_path,
};

#[cfg(test)]
pub(crate) use import::{
    import_opml_in_db, import_opml_inner, parse_import_opml,
    FORCE_IMPORT_QUERY_STATISTICS_REFRESH_FAILURE, OPML_IMPORT_CONTENT_TOO_LARGE_MESSAGE,
};

#[cfg(test)]
pub(crate) use crate::commands::dto::AppError;
#[cfg(test)]
pub(crate) use crate::domain::feed::Feed;
#[cfg(test)]
pub(crate) use crate::domain::folder::Folder;
#[cfg(test)]
pub(crate) use crate::domain::types::{AccountId, FeedId, FolderId};
#[cfg(test)]
pub(crate) use crate::infra::opml::{self, OpmlFeed};

#[cfg(test)]
mod tests;
