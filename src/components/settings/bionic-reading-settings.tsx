import { useMemo } from "react";
import { SectionHeading, SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";
import { applyBionicReading } from "@/lib/bionic-reading";
import { usePreferencesStore } from "@/stores/preferences-store";

const fixationOptions = [
  { value: "1", label: "1 — Minimal" },
  { value: "2", label: "2 — Light" },
  { value: "3", label: "3 — Medium" },
  { value: "4", label: "4 — Strong" },
  { value: "5", label: "5 — Maximum" },
];

const previewText =
  "Bionic Reading is a new method facilitating the reading process by guiding the eyes through text with artificial fixation points.";

export function BionicReadingSettings() {
  const enabled = usePreferencesStore((s) => s.prefs.bionic_reading ?? "false") === "true";
  const fixation = Number(usePreferencesStore((s) => s.prefs.bionic_fixation ?? "3"));

  const previewHtml = useMemo(
    () => (enabled ? applyBionicReading(previewText, fixation) : previewText),
    [enabled, fixation],
  );

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Bionic Reading</h2>

      <section className="mb-6">
        <SectionHeading>About</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Bionic Reading guides your eyes through text by bolding the initial letters of each word, helping you read
          faster and with better focus.
        </p>
      </section>

      <section className="mb-6">
        <SectionHeading>Settings</SectionHeading>
        <SettingsSwitch label="Enable Bionic Reading" prefKey="bionic_reading" />
        <SettingsSelect label="Fixation strength" prefKey="bionic_fixation" options={fixationOptions} />
      </section>

      <section>
        <SectionHeading>Preview</SectionHeading>
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3">
          <p
            className="text-sm leading-relaxed text-foreground"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: preview uses trusted static text processed by bionic-reading
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </section>
    </div>
  );
}
