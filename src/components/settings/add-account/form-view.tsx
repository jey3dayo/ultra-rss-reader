import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS } from "@/components/settings/shared/settings-surface";
import {
  FormActionButtons,
  LabeledInputRow,
  LabeledSelectRow,
  type LabeledSelectRowProps,
  SurfaceCard,
} from "@/design-system";

const LABEL_COLUMN_CLASS_NAME = "sm:w-40 sm:shrink-0";
const INPUT_CLASS_NAME = `h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`;

export type AddAccountInputControl = {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
  disabled: boolean;
  errorText?: string;
};

export type AddAccountCredentialsSection = {
  heading: string;
  serverUrl?: AddAccountInputControl;
  credential: AddAccountInputControl;
  password: AddAccountInputControl;
};

type AddAccountFormSelectControl = Pick<LabeledSelectRowProps, "label" | "name" | "value" | "options" | "onChange"> & {
  disabled: boolean;
};

type AddAccountFormSelectRowProps = {
  control: AddAccountFormSelectControl;
};

type AddAccountFormInputRowProps = {
  control: AddAccountInputControl;
};

type AddAccountFormViewProps = {
  title: string;
  accountHeading: string;
  accountType: AddAccountFormSelectControl;
  accountName: AddAccountInputControl;
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
      triggerClassName={SETTINGS_CONTROL_SURFACE_CLASS}
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
      errorText={control.errorText}
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
        action={() => {
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
          <SurfaceCard variant="info" tone="danger" padding="compact" role="alert" aria-live="assertive">
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
