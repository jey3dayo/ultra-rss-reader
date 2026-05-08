import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { SurfaceCard } from "@/components/shared/surface-card";
import type { OptionWithLabel } from "@/lib/ui/options";

const LABEL_COLUMN_CLASS_NAME = "sm:w-40 sm:shrink-0";
const INPUT_CLASS_NAME = "h-10";

type AddAccountFormSelectControl = {
  label: string;
  name: string;
  value: string;
  options: readonly OptionWithLabel[];
  onChange: (value: string) => void;
  disabled: boolean;
};

type AddAccountFormInputControl = {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

type AddAccountCredentialsSection = {
  heading: string;
  serverUrl?: AddAccountFormInputControl;
  credential: AddAccountFormInputControl;
  password: AddAccountFormInputControl;
};

type AddAccountFormSelectRowProps = {
  control: AddAccountFormSelectControl;
};

type AddAccountFormInputRowProps = {
  control: AddAccountFormInputControl;
};

type AddAccountFormViewProps = {
  title: string;
  accountHeading: string;
  accountType: AddAccountFormSelectControl;
  accountName: AddAccountFormInputControl;
  credentialsSection?: AddAccountCredentialsSection;
  errorMessage?: string | null;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

function AddAccountSelectRow({ control }: AddAccountFormSelectRowProps) {
  return (
    <LabeledSelectRow
      label={control.label}
      name={control.name}
      value={control.value}
      options={control.options}
      onChange={control.onChange}
      disabled={control.disabled}
    />
  );
}

function AddAccountInputRow({ control }: AddAccountFormInputRowProps) {
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

export function AddAccountFormView({
  title,
  accountHeading,
  accountType,
  accountName,
  credentialsSection,
  errorMessage,
  submitLabel,
  submittingLabel,
  cancelLabel,
  submitting,
  onSubmit,
  onCancel,
}: AddAccountFormViewProps) {
  return (
    <SettingsContentLayout title={title} maxWidthClassName="max-w-[640px]" contentTestId="add-account-form-layout">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <SettingsSection heading={accountHeading}>
          <AddAccountSelectRow control={accountType} />
          <AddAccountInputRow control={accountName} />
        </SettingsSection>

        {credentialsSection && (
          <SettingsSection heading={credentialsSection.heading}>
            {credentialsSection.serverUrl && <AddAccountInputRow control={credentialsSection.serverUrl} />}
            <AddAccountInputRow control={credentialsSection.credential} />
            <AddAccountInputRow control={credentialsSection.password} />
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
    </SettingsContentLayout>
  );
}
