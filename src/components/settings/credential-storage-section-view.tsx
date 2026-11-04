import { cn } from "cn";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { PHRASE_AWARE_TEXT_CLASS_NAME } from "@/constants";
import { LabeledSelectRow, SurfaceCard } from "@/design-system";
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
  loadErrorMessage?: string | null;
  configurable: boolean;
  saving: boolean;
  errorMessage?: string | null;
  cleanupNotice?: string | null;
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
  loadErrorMessage,
  configurable,
  saving,
  errorMessage,
  cleanupNotice,
  onStorageChange,
}: CredentialStorageSectionViewProps) {
  if (loadErrorMessage) {
    return (
      <SettingsSection heading={heading} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
        <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
          <p className="text-sm leading-[1.5]">{loadErrorMessage}</p>
        </SurfaceCard>
      </SettingsSection>
    );
  }

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
      {errorMessage && (
        <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
          <p className="text-sm leading-[1.5]">{errorMessage}</p>
        </SurfaceCard>
      )}
      {cleanupNotice && (
        <SurfaceCard variant="info" tone="warning" padding="compact" role="status">
          <p className="text-sm leading-[1.5]">{cleanupNotice}</p>
        </SurfaceCard>
      )}
      <p className="text-(length:--font-size-sm) leading-[1.5] text-foreground-soft">{description}</p>
      {storage === "local_file" && (
        <p
          className={cn(
            "font-sans text-(length:--font-size-sm) leading-[1.5] text-foreground-soft",
            PHRASE_AWARE_TEXT_CLASS_NAME,
          )}
        >
          {localFileWarning}
        </p>
      )}
    </SettingsSection>
  );
}
