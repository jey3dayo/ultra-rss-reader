import type { ReactNode } from "react";
import { SidebarSectionShell } from "@/components/shared/sidebar-section-shell";

type SidebarFeedSectionViewProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  contextMenu?: ReactNode;
};

export function SidebarFeedSection({ title, isOpen, onToggle, contextMenu }: SidebarFeedSectionViewProps) {
  return <SidebarSectionShell title={title} isOpen={isOpen} onToggle={onToggle} contextMenu={contextMenu} />;
}
