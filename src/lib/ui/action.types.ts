export type UiFeedbackAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean | (() => boolean);
};
