#[cfg(windows)]
fn copy_webview2_loader() -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;

    let out_dir = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR should be set"));
    let Some(profile_dir) = out_dir.ancestors().find(|path| {
        path.file_name()
            .is_some_and(|name| name == "debug" || name == "release")
    }) else {
        return Err("Could not determine Cargo profile directory from OUT_DIR".to_string());
    };

    let Some(build_dir) = profile_dir.join("build").canonicalize().ok() else {
        return Err("Could not resolve Cargo build directory for WebView2 loader copy".to_string());
    };

    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_else(|_| "x64".to_string());
    let webview2_arch = match arch.as_str() {
        "x86_64" => "x64",
        "x86" => "x86",
        "aarch64" => "arm64",
        other => {
            return Err(format!(
                "Unsupported target arch for WebView2 loader copy: {other}"
            ));
        }
    };

    let source = find_webview2_loader(&build_dir, webview2_arch);
    let Some(source) = source else {
        return Err("Could not find WebView2Loader.dll to copy".to_string());
    };

    for destination_dir in [profile_dir.to_path_buf(), profile_dir.join("deps")] {
        if let Err(error) = fs::create_dir_all(&destination_dir) {
            return Err(format!(
                "Failed to create WebView2 loader destination {}: {error}",
                destination_dir.display(),
            ));
        }

        let destination = destination_dir.join("WebView2Loader.dll");
        if let Err(error) = fs::copy(&source, &destination) {
            return Err(format!(
                "Failed to copy WebView2Loader.dll to {}: {error}",
                destination.display(),
            ));
        }
    }

    Ok(())
}

#[cfg(windows)]
fn find_webview2_loader(build_dir: &std::path::Path, arch: &str) -> Option<std::path::PathBuf> {
    let entries = std::fs::read_dir(build_dir).ok()?;
    for entry in entries.flatten() {
        let candidate = entry
            .path()
            .join("out")
            .join(arch)
            .join("WebView2Loader.dll");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

#[cfg(windows)]
fn embed_windows_manifest() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS");
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV");
    if Ok("windows") != target_os.as_deref() || Ok("msvc") != target_env.as_deref() {
        return;
    }

    let manifest = std::env::current_dir()
        .expect("current dir should be available")
        .join("windows-test-manifest.xml");
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    println!("cargo:rustc-link-arg=/WX");
}

fn main() {
    #[cfg(windows)]
    {
        copy_webview2_loader()
            .expect("failed to copy WebView2Loader.dll for Windows release smoke");
        let target_os = std::env::var("CARGO_CFG_TARGET_OS");
        let target_env = std::env::var("CARGO_CFG_TARGET_ENV");
        if Ok("windows") == target_os.as_deref() && Ok("msvc") == target_env.as_deref() {
            embed_windows_manifest();
            tauri_build::try_build(
                tauri_build::Attributes::new()
                    .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest()),
            )
            .expect("failed to run tauri-build");
            return;
        }
    }

    tauri_build::build()
}
