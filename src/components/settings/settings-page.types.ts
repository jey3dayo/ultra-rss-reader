import type { OptionWithLabel } from "@/lib/ui/options";

type SettingsPageOption = OptionWithLabel;

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
  actionLoading?: boolean;
  actionLoadingLabel?: string;
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

type SettingsPageSelectControl = SettingsPageControlHeader<"select"> &
  SettingsPageFieldIdentity & {
    value: string;
    options: SettingsPageOption[];
    onChange: (value: string) => void;
    open?: boolean;
  };

type SettingsPageSwitchControl = SettingsPageControlHeader<"switch"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type SettingsPageTextFieldControl = SettingsPageControlHeader<"text"> &
  SettingsPageFieldIdentity & {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };

type SettingsPageTextControl = SettingsPageTextFieldControl & (SettingsPageTextAction | SettingsPageTextWithoutAction);

type SettingsPageActionControl = SettingsPageControlHeader<"action"> &
  SettingsPageInlineAction & {
    actionAriaLabel?: string;
    rowClassName?: string;
    labelClassName?: string;
  };

type SettingsPageInfoControl = SettingsPageControlHeader<"info"> & {
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
