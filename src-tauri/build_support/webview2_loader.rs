use std::path::{Path, PathBuf};

pub(crate) fn find_webview2_loader(build_dir: &Path, arch: &str) -> Option<PathBuf> {
    for package_entry in std::fs::read_dir(build_dir).ok()?.flatten() {
        let candidate = package_entry
            .path()
            .join("out")
            .join(arch)
            .join("WebView2Loader.dll");
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    for package_entry in std::fs::read_dir(build_dir).ok()?.flatten() {
        let package_dir = package_entry.path();
        let Ok(hash_entries) = std::fs::read_dir(package_dir) else {
            continue;
        };

        for hash_entry in hash_entries.flatten() {
            let candidate = hash_entry
                .path()
                .join("out")
                .join(arch)
                .join("WebView2Loader.dll");
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}
