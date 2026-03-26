import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useUiStore } from "../../stores/ui-store";
import { AccountDetail } from "./AccountDetail";
import { AddAccountForm } from "./AddAccountForm";
import { GeneralSettings } from "./GeneralSettings";
import { SettingsSidebar } from "./SettingsSidebar";

export function SettingsModal() {
  const { settingsOpen, settingsAccountId, settingsAddAccount, closeSettings, openSettings } = useUiStore();

  // Listen for Tauri menu event
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("open-settings", () => openSettings())
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {}); // Ignore in browser mode
    return () => unlisten?.();
  }, [openSettings]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSettings();
      }
    },
    [closeSettings],
  );

  useEffect(() => {
    if (!settingsOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, handleKeyDown]);

  if (!settingsOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeSettings();
  };

  const renderContent = () => {
    if (settingsAccountId) {
      return <AccountDetail />;
    }
    if (settingsAddAccount) {
      return <AddAccountForm />;
    }
    return <GeneralSettings />;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preferences"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={handleOverlayClick}
      onKeyDown={undefined}
    >
      <div
        style={{
          background: "var(--bg-sidebar)",
          borderRadius: 12,
          width: 700,
          maxWidth: "90vw",
          height: 560,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-md)",
            padding: "var(--space-md) var(--space-lg)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            onClick={closeSettings}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              fontSize: "var(--font-size-lg)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            &#10005;
          </button>
          <span style={{ fontSize: "var(--font-size-lg)", fontWeight: "bold", color: "var(--text-primary)" }}>
            Preferences
          </span>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <SettingsSidebar />
          <div style={{ flex: 1, overflowY: "auto" }}>{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
