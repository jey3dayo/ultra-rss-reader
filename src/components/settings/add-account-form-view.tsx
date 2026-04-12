import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function getOptionLabel(options: AddAccountFormOption[], value: string | null) {
  return options.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";
}

function AddAccountSelectRow({ control }: { control: AddAccountFormSelectControl }) {
  const labelId = useId();

  return (
    <LabeledControlRow label={control.label} labelId={labelId}>
      <Select
        name={control.name}
        value={control.value}
        onValueChange={(value) => value !== null && control.onChange(value)}
        disabled={control.disabled}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{(value: string | null) => getOptionLabel(control.options, value)}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {control.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </LabeledControlRow>
  );
}

function AddAccountInputRow({ control }: { control: AddAccountFormInputControl }) {
  const inputId = useId();

  return (
    <LabeledControlRow label={control.label} htmlFor={inputId}>
      <Input
        id={inputId}
        name={control.name}
        type={control.type}
        value={control.value}
        onChange={(event) => control.onChange(event.target.value)}
        placeholder={control.placeholder}
        className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
        disabled={control.disabled}
      />
    </LabeledControlRow>
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
          <Button type="submit" disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </Button>
          <Button variant="outline" type="button" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
