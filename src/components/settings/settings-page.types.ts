type SettingsPageOption = {
  value: string;
  label: string;
};

type SettingsPageControlIdentity = {
  id: string;
};

type SettingsPageFieldIdentity = {
  name: string;
};

type SettingsPageControlHeader<Type extends string> = SettingsPageControlIdentity & {
  label: string;
  type: Type;
  disabled?: boolean;
};

type SettingsPageActionSize = "text" | "compact";

type SettingsPageInlineAction = {
  actionLabel: string;
  onAction: () => void;
  actionSize?: SettingsPageActionSize;
};

type SettingsPageTextAction = SettingsPageInlineAction & {
  actionAriaLabel: string;
  actionDisabled?: boolean;
};

type SettingsPageTextWithoutAction = {
  actionLabel?: never;
  actionAriaLabel?: never;
  onAction?: never;
  actionDisabled?: never;
  actionSize?: never;
};

export type SettingsPageSelectControl = SettingsPageControlHeader<"select"> &
  SettingsPageFieldIdentity & {
    value: string;
    options: SettingsPageOption[];
    onChange: (value: string) => void;
    open?: boolean;
  };

export type SettingsPageSwitchControl = SettingsPageControlHeader<"switch"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type SettingsPageTextFieldControl = SettingsPageControlHeader<"text"> &
  SettingsPageFieldIdentity & {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };

export type SettingsPageTextControl = SettingsPageTextFieldControl &
  (SettingsPageTextAction | SettingsPageTextWithoutAction);

export type SettingsPageActionControl = SettingsPageControlHeader<"action"> &
  SettingsPageInlineAction & {
    actionAriaLabel?: string;
    rowClassName?: string;
    labelClassName?: string;
  };

export type SettingsPageInfoControl = SettingsPageControlHeader<"info"> & {
  value: string;
  valueClassName?: string;
};

export type SettingsPageControl =
  | SettingsPageSelectControl
  | SettingsPageSwitchControl
  | SettingsPageTextControl
  | SettingsPageActionControl
  | SettingsPageInfoControl;

type SettingsPageSection = {
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
