//! Embedded browser child-webview geometry: parsing/validating the bounds payload sent from
//! the frontend, converting it into the native `Rect` the child webview is placed/resized
//! with, and building the (rate-limited, coordinate-bucketed) diagnostics payload used to
//! debug native placement drift.

use serde::Deserialize;
use tauri::{
    LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Rect, Size,
    Window,
};

use crate::browser_webview::{
    browser_webview, browser_webview_diagnostics_enabled, emit_browser_webview_diagnostics,
};
use crate::commands::dto::AppError;

use super::browser_webview_error;

pub(super) const MAX_BROWSER_WEBVIEW_BOUND_VALUE: f64 = i32::MAX as f64;
const BROWSER_WEBVIEW_DIAGNOSTICS_COORDINATE_BUCKET: f64 = 8.0;
const BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE: f64 = 10_000.0;
pub(super) const INVALID_BROWSER_BOUNDS_ERROR: &str =
    "Embedded browser bounds must be finite, within supported coordinate limits, and have positive width/height";

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserWebviewBoundsUnit {
    #[default]
    Logical,
    Physical,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserWebviewBounds {
    /// Bounds captured from the main webview viewport coordinate space.
    pub(super) x: f64,
    pub(super) y: f64,
    pub(super) width: f64,
    pub(super) height: f64,
    #[serde(default)]
    pub(super) unit: BrowserWebviewBoundsUnit,
}

impl BrowserWebviewBounds {
    fn validated(self) -> Result<Self, AppError> {
        if !self.x.is_finite()
            || !self.y.is_finite()
            || !self.width.is_finite()
            || !self.height.is_finite()
            || self.width <= 0.0
            || self.height <= 0.0
            || self.x.abs() > MAX_BROWSER_WEBVIEW_BOUND_VALUE
            || self.y.abs() > MAX_BROWSER_WEBVIEW_BOUND_VALUE
            || self.width > MAX_BROWSER_WEBVIEW_BOUND_VALUE
            || self.height > MAX_BROWSER_WEBVIEW_BOUND_VALUE
        {
            return Err(browser_webview_error(INVALID_BROWSER_BOUNDS_ERROR));
        }

        if self.unit == BrowserWebviewBoundsUnit::Physical
            && (self.width.round() < 1.0 || self.height.round() < 1.0)
        {
            return Err(browser_webview_error(INVALID_BROWSER_BOUNDS_ERROR));
        }

        Ok(self)
    }

    pub(super) fn logical_position(self) -> LogicalPosition<f64> {
        LogicalPosition::new(self.x, self.y)
    }

    pub(super) fn logical_size(self) -> LogicalSize<f64> {
        LogicalSize::new(self.width, self.height)
    }

    fn physical_position(self) -> PhysicalPosition<i32> {
        PhysicalPosition::new(self.x.round() as i32, self.y.round() as i32)
    }

    fn physical_size(self) -> PhysicalSize<u32> {
        PhysicalSize::new(self.width.round() as u32, self.height.round() as u32)
    }

    pub(super) fn rect(self) -> Rect {
        match self.unit {
            BrowserWebviewBoundsUnit::Logical => Rect {
                position: Position::Logical(self.logical_position()),
                size: Size::Logical(self.logical_size()),
            },
            BrowserWebviewBoundsUnit::Physical => Rect {
                position: Position::Physical(self.physical_position()),
                size: Size::Physical(self.physical_size()),
            },
        }
    }
}

pub(super) fn validated_bounds(
    bounds: BrowserWebviewBounds,
) -> Result<BrowserWebviewBounds, AppError> {
    bounds.validated()
}

pub(super) fn child_webview_rect_from_browser_bounds(bounds: BrowserWebviewBounds) -> Rect {
    // Child webviews use the main webview viewport coordinate space.
    // Do not add native title bar or menu insets here.
    bounds.rect()
}

fn normalized_scale_factor(scale_factor: f64) -> f64 {
    if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    }
}

pub(super) fn child_webview_add_child_bounds(
    bounds: BrowserWebviewBounds,
    scale_factor: f64,
) -> (LogicalPosition<f64>, LogicalSize<f64>) {
    let rect = child_webview_rect_from_browser_bounds(bounds);
    let scale_factor = normalized_scale_factor(scale_factor);

    (
        rect.position.to_logical::<f64>(scale_factor),
        rect.size.to_logical::<f64>(scale_factor),
    )
}

fn browser_webview_diagnostics_number(value: f64) -> f64 {
    let bucketed = (value / BROWSER_WEBVIEW_DIAGNOSTICS_COORDINATE_BUCKET).round()
        * BROWSER_WEBVIEW_DIAGNOSTICS_COORDINATE_BUCKET;
    bucketed.clamp(
        -BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE,
        BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE,
    )
}

fn browser_webview_diagnostics_rect(
    position: LogicalPosition<f64>,
    size: LogicalSize<f64>,
) -> crate::browser_webview::BrowserWebviewLogicalRect {
    crate::browser_webview::BrowserWebviewLogicalRect {
        x: browser_webview_diagnostics_number(position.x),
        y: browser_webview_diagnostics_number(position.y),
        width: browser_webview_diagnostics_number(size.width),
        height: browser_webview_diagnostics_number(size.height),
    }
}

pub(super) fn browser_webview_bounds_diagnostics_payload(
    action: &str,
    bounds: BrowserWebviewBounds,
    rect: &Rect,
    scale_factor: f64,
    native_webview_bounds: Option<crate::browser_webview::BrowserWebviewLogicalRect>,
) -> Option<crate::browser_webview::BrowserWebviewDiagnosticsPayload> {
    if !browser_webview_diagnostics_enabled() {
        return None;
    }

    let applied_position = rect.position.to_logical::<f64>(scale_factor);
    let applied_size = rect.size.to_logical::<f64>(scale_factor);
    Some(crate::browser_webview::BrowserWebviewDiagnosticsPayload {
        action: action.to_string(),
        requested_logical: browser_webview_diagnostics_rect(
            bounds.logical_position(),
            bounds.logical_size(),
        ),
        applied_logical: browser_webview_diagnostics_rect(applied_position, applied_size),
        scale_factor,
        native_webview_bounds: native_webview_bounds.map(|bounds| {
            browser_webview_diagnostics_rect(
                LogicalPosition::new(bounds.x, bounds.y),
                LogicalSize::new(bounds.width, bounds.height),
            )
        }),
    })
}

pub(super) fn log_browser_webview_bounds(
    window: &Window,
    action: &str,
    bounds: BrowserWebviewBounds,
    rect: &Rect,
) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let native_webview_bounds = browser_webview(window).and_then(|browser_webview| {
        browser_webview.bounds().ok().map(|bounds| {
            let position = bounds.position.to_logical::<f64>(scale_factor);
            let size = bounds.size.to_logical::<f64>(scale_factor);
            crate::browser_webview::BrowserWebviewLogicalRect {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            }
        })
    });
    let Some(payload) = browser_webview_bounds_diagnostics_payload(
        action,
        bounds,
        rect,
        scale_factor,
        native_webview_bounds,
    ) else {
        return;
    };
    tracing::warn!(
        "embedded-browser diagnostics action={} requested=({},{} {}x{}) applied=({},{} {}x{}) native_webview={:?} scale_factor={}",
        payload.action,
        payload.requested_logical.x,
        payload.requested_logical.y,
        payload.requested_logical.width,
        payload.requested_logical.height,
        payload.applied_logical.x,
        payload.applied_logical.y,
        payload.applied_logical.width,
        payload.applied_logical.height,
        payload.native_webview_bounds,
        payload.scale_factor,
    );
    emit_browser_webview_diagnostics(window.app_handle(), &payload);
}
