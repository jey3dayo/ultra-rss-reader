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
