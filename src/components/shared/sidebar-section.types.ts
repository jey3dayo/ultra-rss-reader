import type { ReactNode } from "react";

export type SidebarSectionToggleProps = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  contextMenu?: ReactNode;
};

export type SidebarSectionShellProps = {
  title?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  headerClassName?: string;
  bodyClassName?: string;
  children?: ReactNode;
};
