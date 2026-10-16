#[cfg(not(test))]
use crate::{MAIN_WINDOW_MIN_HEIGHT, MAIN_WINDOW_MIN_WIDTH};

pub(crate) fn main_window_title_bar_uses_overlay() -> bool {
    cfg!(target_os = "macos")
}

#[cfg(not(test))]
pub(crate) fn main_window_title_bar_style() -> tauri::TitleBarStyle {
    if main_window_title_bar_uses_overlay() {
        tauri::TitleBarStyle::Overlay
    } else {
        tauri::TitleBarStyle::Visible
    }
}

#[cfg(not(test))]
pub(crate) fn main_window_min_size() -> tauri::Size {
    tauri::Size::Logical(tauri::LogicalSize::new(
        MAIN_WINDOW_MIN_WIDTH as f64,
        MAIN_WINDOW_MIN_HEIGHT as f64,
    ))
}

/// Window-state restore saves the physical inner size, so a size captured on a
/// large or high-DPI display can exceed the work area the app reopens on.
/// Returns the corrected inner size, or `None` when the restored size already
/// fits.
///
/// `decoration` is `outer - inner`, so the clamp keeps the *outer* window inside
/// the work area instead of letting decorations push the bottom edge off-screen.
/// `work_area_size` is `None` when the monitor is unknown.
pub(crate) fn clamped_main_window_physical_inner_size(
    restored_inner: (u32, u32),
    decoration: (u32, u32),
    work_area_size: Option<(u32, u32)>,
    min_inner: (u32, u32),
) -> Option<(u32, u32)> {
    let (min_width, min_height) = min_inner;
    // `clamp` panics when min > max, and `.max(min_*)` is what prevents it: a
    // work area smaller than the minimum layout size must not shrink the window
    // below the size the ultra-compact layout needs.
    let (max_width, max_height) = match work_area_size {
        Some((work_width, work_height)) => (
            work_width.saturating_sub(decoration.0).max(min_width),
            work_height.saturating_sub(decoration.1).max(min_height),
        ),
        None => (u32::MAX, u32::MAX),
    };

    let clamped = (
        restored_inner.0.clamp(min_width, max_width),
        restored_inner.1.clamp(min_height, max_height),
    );
    if clamped == restored_inner {
        return None;
    }
    Some(clamped)
}

/// Centers a window of `outer_size` inside the work area.
///
/// The math stays in physical pixels: converting the monitor rect with the
/// monitor scale factor and then applying a logical position, which Tauri
/// converts back with the *window* scale factor, does not round-trip on a
/// mixed-DPI multi-monitor setup and can land the window on the wrong display.
pub(crate) fn centered_main_window_physical_position(
    work_area_position: (i32, i32),
    work_area_size: (u32, u32),
    outer_size: (u32, u32),
) -> (i32, i32) {
    let inset =
        |work: u32, window: u32| i32::try_from(work.saturating_sub(window) / 2).unwrap_or(i32::MAX);
    (
        work_area_position
            .0
            .saturating_add(inset(work_area_size.0, outer_size.0)),
        work_area_position
            .1
            .saturating_add(inset(work_area_size.1, outer_size.1)),
    )
}

/// Applies the size guards for a window whose state was just restored, then
/// re-centers it: `set_size` pins the top-left corner, so a restored size that
/// differs from the configured default would otherwise leave the window visibly
/// off-center.
///
/// The centered position is computed from the size this function is applying
/// rather than read back from the window, because the platform may not have
/// committed the new frame yet: `Window::center` observed here would still use
/// the size the window had before the guard ran.
#[cfg(all(desktop, not(test)))]
pub(crate) fn clamp_main_window_size_after_state_restore<R: tauri::Runtime>(
    window: &tauri::Window<R>,
) {
    let Ok(scale_factor) = window.scale_factor() else {
        tracing::warn!("Failed to read main window scale factor while clamping restored size");
        return;
    };
    let Ok(inner) = window.inner_size() else {
        tracing::warn!("Failed to read main window inner size while clamping restored size");
        return;
    };
    let Ok(outer) = window.outer_size() else {
        tracing::warn!("Failed to read main window outer size while clamping restored size");
        return;
    };

    let decoration = (
        outer.width.saturating_sub(inner.width),
        outer.height.saturating_sub(inner.height),
    );
    // The work area excludes the macOS menu bar and the Windows taskbar, so a
    // restored full-height window keeps a draggable title bar on screen.
    let work_area = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|monitor| *monitor.work_area());
    let min_inner = (
        (MAIN_WINDOW_MIN_WIDTH as f64 * scale_factor).round() as u32,
        (MAIN_WINDOW_MIN_HEIGHT as f64 * scale_factor).round() as u32,
    );

    let applied_inner = match clamped_main_window_physical_inner_size(
        (inner.width, inner.height),
        decoration,
        work_area.map(|rect| (rect.size.width, rect.size.height)),
        min_inner,
    ) {
        Some((width, height)) => {
            let clamped_size = tauri::Size::Physical(tauri::PhysicalSize::new(width, height));
            if let Err(error) = window.set_size(clamped_size) {
                tracing::warn!("Failed to clamp restored main window size: {error}");
            }
            (width, height)
        }
        None => (inner.width, inner.height),
    };

    let Some(rect) = work_area else {
        if let Err(error) = window.center() {
            tracing::warn!("Failed to re-center main window after size restore: {error}");
        }
        return;
    };
    let (x, y) = centered_main_window_physical_position(
        (rect.position.x, rect.position.y),
        (rect.size.width, rect.size.height),
        (
            applied_inner.0.saturating_add(decoration.0),
            applied_inner.1.saturating_add(decoration.1),
        ),
    );
    let position = tauri::Position::Physical(tauri::PhysicalPosition::new(x, y));
    if let Err(error) = window.set_position(position) {
        tracing::warn!("Failed to center main window after size restore: {error}");
    }
}

#[cfg(not(test))]
pub(crate) fn enforce_main_window_min_size_after_window_resize<R: tauri::Runtime>(
    window: &tauri::Window<R>,
    size: tauri::PhysicalSize<u32>,
) {
    let Ok(scale_factor) = window.scale_factor() else {
        tracing::warn!("Failed to read main window scale factor while enforcing minimum size");
        return;
    };
    let logical_width = f64::from(size.width) / scale_factor;
    let logical_height = f64::from(size.height) / scale_factor;
    if logical_width >= MAIN_WINDOW_MIN_WIDTH as f64
        && logical_height >= MAIN_WINDOW_MIN_HEIGHT as f64
    {
        return;
    }

    let next_size = tauri::Size::Logical(tauri::LogicalSize::new(
        logical_width.max(MAIN_WINDOW_MIN_WIDTH as f64),
        logical_height.max(MAIN_WINDOW_MIN_HEIGHT as f64),
    ));
    if let Err(error) = window.set_size(next_size) {
        tracing::warn!("Failed to restore main window minimum size after resize: {error}");
    }
}
