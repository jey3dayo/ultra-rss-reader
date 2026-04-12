export type SettingsPageOption = {
  value: string;
  label: string;
};

export type SettingsPageSelectControl = {
  id: string;
  type: "select";
  name: string;
  label: string;
  value: string;
  options: SettingsPageOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
};

export type SettingsPageSwitchControl = {
  id: string;
  type: "switch";
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export type SettingsPageTextControl = {
  id: string;
  type: "text";
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export type SettingsPageActionControl = {
  id: string;
  type: "action";
  label: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
};

export type SettingsPageControl =
  | SettingsPageSelectControl
  | SettingsPageSwitchControl
  | SettingsPageTextControl
  | SettingsPageActionControl;

export type SettingsPageSection = {
  id: string;
  heading: string;
  controls: SettingsPageControl[];
  note?: string;
};

export type SettingsPageViewProps = {
  title: string;
  sections: SettingsPageSection[];
};
