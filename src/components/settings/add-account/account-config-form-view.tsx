import { ChevronLeft } from "lucide-react";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { SurfaceCard } from "@/components/shared/surface-card";
import { cn } from "@/lib/utils";
import type { AddAccountCredentialsSection, AddAccountInputControl } from "./form-view";
import type { ServicePresentation } from "./services.types";

const LABEL_COLUMN_CLASS_NAME = "sm:w-40 sm:shrink-0";
const INPUT_CLASS_NAME = "h-10";

type AccountConfigFormViewProps = {
  title: string;
  backLabel: string;
  backAriaLabel: string;
  serviceSummary?: ServicePresentation;
  accountHeading: string;
  accountName: AddAccountInputControl;
  credentialsSection?: AddAccountCredentialsSection;
  errorMessage?: string | null;
  cancelLabel: string;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function AccountConfigInputRow({ control }: { control: AddAccountInputControl }) {
  return (
    <LabeledInputRow
      label={control.label}
      name={control.name}
      type={control.type}
      value={control.value}
      onChange={control.onChange}
      placeholder={control.placeholder}
      labelClassName={LABEL_COLUMN_CLASS_NAME}
      inputClassName={INPUT_CLASS_NAME}
      disabled={control.disabled}
    />
  );
}

export function AccountConfigFormView({
  title,
  backLabel,
  backAriaLabel,
  serviceSummary,
  accountHeading,
  accountName,
  credentialsSection,
  errorMessage,
  cancelLabel,
  submitLabel,
  submittingLabel,
  submitting,
  onBack,
  onCancel,
  onSubmit,
}: AccountConfigFormViewProps) {
  return (
    <div className="p-6">
      <div className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/60 pb-4">
        <SettingsActionButton
          type="button"
          tone="subtle"
          size="compact"
          onClick={onBack}
          disabled={submitting}
          aria-label={backAriaLabel}
          className="h-8 gap-0.5 justify-self-start bg-transparent px-1 text-sm shadow-none"
        >
          <ChevronLeft className="size-4" />
          {backLabel}
        </SettingsActionButton>
        <h2 className="text-center font-sans text-[19px] font-medium tracking-[-0.02em] text-foreground">{title}</h2>
        <div aria-hidden="true" className="size-8 justify-self-end" />
      </div>

      {serviceSummary && (
        <SurfaceCard variant="info" tone="subtle" padding="compact" className="mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", serviceSummary.iconBg)}>
              <serviceSummary.icon className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span>{serviceSummary.name}</span>
              </div>
              <div className="font-serif text-xs leading-[1.45] text-foreground-soft">{serviceSummary.description}</div>
            </div>
          </div>
        </SurfaceCard>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <SettingsSection heading={accountHeading}>
          <AccountConfigInputRow control={accountName} />
        </SettingsSection>

        {credentialsSection && (
          <SettingsSection heading={credentialsSection.heading}>
            {credentialsSection.serverUrl && <AccountConfigInputRow control={credentialsSection.serverUrl} />}
            <AccountConfigInputRow control={credentialsSection.credential} />
            <AccountConfigInputRow control={credentialsSection.password} />
          </SettingsSection>
        )}

        {errorMessage ? (
          <SurfaceCard variant="info" tone="danger" padding="compact">
            <p className="font-serif text-sm leading-[1.5]">{errorMessage}</p>
          </SurfaceCard>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <FormActionButtons
            cancelLabel={cancelLabel}
            submitLabel={submitLabel}
            submittingLabel={submittingLabel}
            loading={submitting}
            submitDisabled={submitting}
            cancelDisabled={submitting}
            onCancel={onCancel}
            submitType="submit"
          />
        </div>
      </form>
    </div>
  );
}
