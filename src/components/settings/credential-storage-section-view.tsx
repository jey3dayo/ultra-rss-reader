import { cn } from "cn";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { PHRASE_AWARE_TEXT_CLASS_NAME } from "@/constants";
import { LabeledSelectRow } from "@/design-system";
import type { OptionWithLabel } from "@/lib/ui/options";

type CredentialStorageSectionViewProps = {
  heading: string;
  label: string;
  description: string;
  osKeychainLabel: string;
  localFileLabel: string;
  localFileWarning: string;
  storage: string | null;
  loaded: boolean;
  configurable: boolean;
  saving: boolean;
  onStorageChange: (next: string) => void;
};

export function CredentialStorageSectionView({
  heading,
  label,
  description,
  osKeychainLabel,
  localFileLabel,
  localFileWarning,
  storage,
  loaded,
  configurable,
  saving,
  onStorageChange,
}: CredentialStorageSectionViewProps) {
  if (!loaded || !configurable || storage === null) {
    return null;
  }

  const options: OptionWithLabel[] = [
    { value: "os_keychain", label: osKeychainLabel },
    { value: "local_file", label: localFileLabel },
  ];

  return (
    <SettingsSection heading={heading} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
      <LabeledSelectRow
        label={label}
        name="credential_storage"
        value={storage}
        options={options}
        onChange={onStorageChange}
        disabled={saving}
        triggerClassName="sm:min-w-[220px]"
      />
      <p className="text-[13px] leading-[1.5] text-foreground-soft">{description}</p>
      {storage === "local_file" && (
        <p className={cn("font-sans text-[13px] leading-[1.5] text-foreground-soft", PHRASE_AWARE_TEXT_CLASS_NAME)}>
          {localFileWarning}
        </p>
      )}
    </SettingsSection>
  );
}
