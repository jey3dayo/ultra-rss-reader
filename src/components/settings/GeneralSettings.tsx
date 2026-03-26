import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

export function GeneralSettings() {
  return (
    <div style={{ padding: "var(--space-lg) 0" }}>
      <SettingsSection title="About">
        <SettingsRow label="Version">0.1.0</SettingsRow>
      </SettingsSection>
    </div>
  );
}
