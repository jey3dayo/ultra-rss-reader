import type { ReactNode } from "react";

export type SidebarSectionToggleProps = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  renderWrapper?: (toggle: ReactNode) => ReactNode;
};

export type SidebarSectionShellProps = {
  title?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  headerClassName?: string;
  bodyClassName?: string;
  children?: ReactNode;
};
