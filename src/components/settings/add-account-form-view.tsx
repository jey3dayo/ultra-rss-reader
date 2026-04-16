import type {
  AddAccountFormInputRowProps,
  AddAccountFormSelectRowProps,
  AddAccountFormViewProps,
} from "@/components/settings/add-account-form.types";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { SectionHeading } from "@/components/shared/section-heading";

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
      rowClassName="flex-col items-stretch sm:flex-row sm:items-center"
      inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:w-auto"
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
      <h2 className="mb-6 text-center text-lg font-semibold">{title}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <section className="mb-6">
          <SectionHeading>{accountHeading}</SectionHeading>
          <AddAccountSelectRow control={accountType} />
          <AddAccountInputRow control={accountName} />
        </section>

        {credentialsSection && (
          <section className="mb-6">
            <SectionHeading>{credentialsSection.heading}</SectionHeading>
            {credentialsSection.serverUrl && <AddAccountInputRow control={credentialsSection.serverUrl} />}
            <AddAccountInputRow control={credentialsSection.credential} />
            <AddAccountInputRow control={credentialsSection.password} />
          </section>
        )}

        {errorMessage && <p className="mb-4 text-sm text-state-danger-foreground">{errorMessage}</p>}

        <div className="flex gap-3">
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
