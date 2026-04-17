import type {
  AddAccountFormInputRowProps,
  AddAccountFormSelectRowProps,
  AddAccountFormViewProps,
} from "@/components/settings/add-account-form.types";
import { SettingsSection } from "@/components/settings/settings-section";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { SurfaceCard } from "@/components/shared/surface-card";

const LABEL_COLUMN_CLASS_NAME = "sm:w-40 sm:shrink-0";
const INPUT_CLASS_NAME = "h-10";

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
    <div className="p-6">
      <h2 className="mb-5 border-b border-border/60 pb-4 text-center font-sans text-[19px] font-medium tracking-[-0.02em] text-foreground">
        {title}
      </h2>
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
    </div>
  );
}
