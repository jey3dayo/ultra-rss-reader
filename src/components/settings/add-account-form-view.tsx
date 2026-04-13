import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { SectionHeading } from "@/components/shared/section-heading";

export type AddAccountFormOption = {
  value: string;
  label: string;
};

export type AddAccountFormSelectControl = {
  label: string;
  name: string;
  value: string;
  options: AddAccountFormOption[];
  onChange: (value: string) => void;
  disabled: boolean;
};

export type AddAccountFormInputControl = {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

export type AddAccountCredentialsSection = {
  heading: string;
  serverUrl?: AddAccountFormInputControl;
  credential: AddAccountFormInputControl;
  password: AddAccountFormInputControl;
};

export type AddAccountFormViewProps = {
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

function AddAccountSelectRow({ control }: { control: AddAccountFormSelectControl }) {
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

function AddAccountInputRow({ control }: { control: AddAccountFormInputControl }) {
  return (
    <LabeledInputRow
      label={control.label}
      name={control.name}
      type={control.type}
      value={control.value}
      onChange={control.onChange}
      placeholder={control.placeholder}
      inputClassName="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
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

        {errorMessage && <p className="mb-4 text-sm text-destructive">{errorMessage}</p>}

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
