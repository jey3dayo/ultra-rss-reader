import type { TFunction } from "i18next";

export type SettingsPreferenceViewPropsParams = {
  t: TFunction<"settings">;
  prefs: Record<string, string>;
  setPref: (key: string, value: string) => void;
};

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
  actionLabel?: string;
  actionAriaLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
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
  sectionSurface?: "card" | "flat";
};

export type SettingsPageSelectRowProps = {
  control: SettingsPageSelectControl;
};

export type SettingsPageSwitchRowProps = {
  control: SettingsPageSwitchControl;
};

export type SettingsPageTextRowProps = {
  control: SettingsPageTextControl;
};

export type SettingsPageActionRowProps = {
  control: SettingsPageActionControl;
};
