//! Startup, window, logging, and shutdown helpers used by `run()`.

#[cfg(not(test))]
pub(crate) mod focus;
pub(crate) mod lifecycle;
pub(crate) mod logs;
pub(crate) mod messages;
pub(crate) mod redaction;
pub(crate) mod window;
