#[cfg(windows)]
fn copy_webview2_loader() {
    use std::fs;
    use std::path::PathBuf;

    let out_dir = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR should be set"));
    let Some(profile_dir) = out_dir.ancestors().find(|path| {
        path.file_name()
            .is_some_and(|name| name == "debug" || name == "release")
    }) else {
        println!("cargo:warning=Could not determine Cargo profile directory from OUT_DIR");
        return;
    };

    let Some(build_dir) = profile_dir.join("build").canonicalize().ok() else {
        println!("cargo:warning=Could not resolve Cargo build directory for WebView2 loader copy");
        return;
    };

    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_else(|_| "x64".to_string());
    let webview2_arch = match arch.as_str() {
        "x86_64" => "x64",
        "x86" => "x86",
        "aarch64" => "arm64",
        other => {
            println!("cargo:warning=Unsupported target arch for WebView2 loader copy: {other}");
            return;
        }
    };

    let source = find_webview2_loader(&build_dir, webview2_arch);
    let Some(source) = source else {
        println!("cargo:warning=Could not find WebView2Loader.dll to copy");
        return;
    };

    for destination_dir in [profile_dir.to_path_buf(), profile_dir.join("deps")] {
        if let Err(error) = fs::create_dir_all(&destination_dir) {
            println!(
                "cargo:warning=Failed to create WebView2 loader destination {}: {error}",
                destination_dir.display()
            );
            continue;
        }

        let destination = destination_dir.join("WebView2Loader.dll");
        if let Err(error) = fs::copy(&source, &destination) {
            println!(
                "cargo:warning=Failed to copy WebView2Loader.dll to {}: {error}",
                destination.display()
            );
        }
    }
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
        copy_webview2_loader();
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
