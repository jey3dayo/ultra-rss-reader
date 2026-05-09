export type AddAccountInputControl = {
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
  serverUrl?: AddAccountInputControl;
  credential: AddAccountInputControl;
  password: AddAccountInputControl;
};
