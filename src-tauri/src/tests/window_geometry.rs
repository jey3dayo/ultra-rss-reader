use super::*;

const TEST_DECORATION: (u32, u32) = (0, 28);
const TEST_MIN_INNER: (u32, u32) = (MAIN_WINDOW_MIN_WIDTH as u32, MAIN_WINDOW_MIN_HEIGHT as u32);

#[test]
fn restored_main_window_size_within_the_work_area_is_kept() {
    assert_eq!(
        clamped_main_window_physical_inner_size(
            (1100, 800),
            TEST_DECORATION,
            Some((1512, 920)),
            TEST_MIN_INNER
        ),
        None
    );
}

#[test]
fn restored_main_window_size_larger_than_the_work_area_is_shrunk() {
    // Saved on a 2560x1440 external display, reopened on a 1512x920 work area.
    assert_eq!(
        clamped_main_window_physical_inner_size(
            (2400, 1300),
            TEST_DECORATION,
            Some((1512, 920)),
            TEST_MIN_INNER
        ),
        Some((1512, 892))
    );
}

#[test]
fn restored_main_window_size_leaves_room_for_window_decorations() {
    // The outer window, not the inner size, has to fit the work area.
    assert_eq!(
        clamped_main_window_physical_inner_size(
            (1512, 920),
            TEST_DECORATION,
            Some((1512, 920)),
            TEST_MIN_INNER
        ),
        Some((1512, 892))
    );
}

#[test]
fn restored_main_window_size_below_minimum_is_grown() {
    assert_eq!(
        clamped_main_window_physical_inner_size(
            (200, 100),
            TEST_DECORATION,
            Some((1512, 920)),
            TEST_MIN_INNER
        ),
        Some(TEST_MIN_INNER)
    );
}

#[test]
fn restored_main_window_size_keeps_minimum_on_a_work_area_smaller_than_the_minimum() {
    assert_eq!(
        clamped_main_window_physical_inner_size(
            (1400, 900),
            TEST_DECORATION,
            Some((400, 300)),
            TEST_MIN_INNER
        ),
        Some(TEST_MIN_INNER)
    );
}

#[test]
fn restored_main_window_size_only_enforces_the_minimum_when_the_monitor_is_unknown() {
    assert_eq!(
        clamped_main_window_physical_inner_size((1400, 900), TEST_DECORATION, None, TEST_MIN_INNER),
        None
    );
    assert_eq!(
        clamped_main_window_physical_inner_size((300, 900), TEST_DECORATION, None, TEST_MIN_INNER),
        Some((TEST_MIN_INNER.0, 900))
    );
}

#[test]
fn restored_main_window_is_centered_for_the_size_being_applied() {
    // Regression: centering read back from the window used the configured
    // 1400x900 default because the restored frame had not been committed yet,
    // which left the window offset on a 3440x1440 display.
    assert_eq!(
        centered_main_window_physical_position((0, 0), (3440, 1440), (900, 700)),
        (1270, 370)
    );
}

#[test]
fn restored_main_window_centering_keeps_the_title_bar_below_the_menu_bar() {
    // macOS-shaped work area: origin below the menu bar, height reduced.
    // A window as tall as the work area must not be placed at y = 0.
    assert_eq!(
        centered_main_window_physical_position((0, 25), (1512, 920), (1512, 920)),
        (0, 25)
    );
}

#[test]
fn restored_main_window_is_centered_on_the_monitor_it_reopens_on() {
    assert_eq!(
        centered_main_window_physical_position((-1512, -200), (1512, 900), (900, 700)),
        (-1206, -100)
    );
}

#[test]
fn main_window_centering_keeps_the_work_area_origin_when_the_window_is_larger() {
    assert_eq!(
        centered_main_window_physical_position((0, 25), (800, 600), (900, 700)),
        (0, 25)
    );
}

#[test]
fn main_window_restores_only_size_without_monitor_bound_state() {
    let lib_rs = include_str!("../lib.rs");
    let tauri_config = include_str!("../../tauri.conf.json");
    let dev_tauri_config = include_str!("../../tauri.dev.conf.json");
    let cargo_toml = include_str!("../../Cargo.toml");
    let release_manual = include_str!("../../../docs/release-manual-verification.md");

    for config in [tauri_config, dev_tauri_config] {
        let config_json: serde_json::Value =
            serde_json::from_str(config).expect("tauri config should remain valid json");
        let window_config = config_json
            .get("app")
            .and_then(|app| app.get("windows"))
            .and_then(|windows| windows.as_array())
            .and_then(|windows| windows.first())
            .expect("main window config should be present");

        assert_eq!(
            window_config
                .get("center")
                .and_then(serde_json::Value::as_bool),
            Some(true),
            "main window should use Tauri's visible-display center fallback"
        );
        assert_eq!(
            window_config.get("width").and_then(serde_json::Value::as_u64),
            Some(1400),
            "main window should keep a logical default width instead of restoring DPI-bound physical size"
        );
        assert_eq!(
            window_config
                .get("height")
                .and_then(serde_json::Value::as_u64),
            Some(900),
            "main window should keep a logical default height instead of restoring DPI-bound physical size"
        );
        assert_eq!(
            window_config
                .get("minWidth")
                .and_then(serde_json::Value::as_u64),
            Some(MAIN_WINDOW_MIN_WIDTH),
            "main window should preserve enough logical width for the ultra-compact browser layout"
        );
        assert_eq!(
            window_config
                .get("minHeight")
                .and_then(serde_json::Value::as_u64),
            Some(MAIN_WINDOW_MIN_HEIGHT),
            "main window should preserve enough logical height for the embedded browser webview"
        );
        assert!(
            !config.contains("\"x\""),
            "main window config must not restore persisted x coordinates"
        );
        assert!(
            !config.contains("\"y\""),
            "main window config must not restore persisted y coordinates"
        );
        assert!(
            !config.contains("position"),
            "main window config must not restore a fixed position"
        );
        assert!(
            window_config.get("maximized").is_none(),
            "main window config must not restore maximized state across monitor topology changes"
        );
        assert!(
            window_config.get("fullscreen").is_none(),
            "main window config must not restore fullscreen state across disconnected monitors"
        );
        assert_eq!(
            window_config.get("visible"),
            Some(&serde_json::Value::Bool(false)),
            "main window should stay hidden until restored geometry is applied"
        );
    }
    assert!(cargo_toml.contains("tauri-plugin-window-state"));
    // Search only production code: this test's own assertion strings would
    // otherwise satisfy the call-site assertions below.
    let test_module_index = lib_rs
        .find("#[cfg(test)]\nmod tests;")
        .expect("lib.rs should keep its test module boundary");
    let lib_rs = [
        &lib_rs[..test_module_index],
        include_str!("../startup/focus.rs"),
    ]
    .join("\n");
    let lib_rs = lib_rs.as_str();
    let state_flags_index = lib_rs
        .find("const MAIN_WINDOW_STATE_FLAGS")
        .expect("main window state flags should be declared in one place");
    let state_flags = &lib_rs[state_flags_index
        ..state_flags_index
            + lib_rs[state_flags_index..]
                .find(';')
                .expect("state flags declaration should be terminated")];
    assert!(
        state_flags.contains("StateFlags::SIZE"),
        "main window size should be restored across launches"
    );
    assert!(
        !state_flags.contains("MAXIMIZED"),
        "the restored maximized state is not readable while the size guards run, so restoring it would un-maximize the window; the last non-maximized size is restored instead"
    );
    assert!(
        !state_flags.contains("POSITION"),
        "restoring position could place the window on a disconnected monitor or at negative coordinates"
    );
    assert!(
        !state_flags.contains("FULLSCREEN"),
        "restoring fullscreen could reopen on a display that no longer exists"
    );
    assert!(
        lib_rs.contains(".with_state_flags(MAIN_WINDOW_STATE_FLAGS)"),
        "the flags constant must be the only place that chooses what is restored"
    );
    assert!(
        lib_rs.contains(".restore_state(MAIN_WINDOW_STATE_FLAGS)"),
        "the flags constant must be the only place that chooses what is restored"
    );
    assert!(
        lib_rs.contains(".skip_initial_state(\"main\")"),
        "the plugin's on-ready restore must stay off so the size guards own the restored geometry"
    );
    assert!(
        lib_rs.contains("clamp_main_window_size_after_state_restore(&tauri_window)"),
        "restored physical sizes need a DPI-change and monitor-shrink guard to actually run"
    );
    assert!(
        lib_rs.contains("save_window_state(MAIN_WINDOW_STATE_FLAGS)"),
        "the custom shutdown drain path prevents the default close, so window state must be saved explicitly"
    );
    assert!(release_manual.contains("disconnecting any external monitor"));
    assert!(release_manual.contains("Saved negative or off-screen window coordinates"));
    assert!(release_manual.contains("A window size saved on an external high-DPI display"));
}
