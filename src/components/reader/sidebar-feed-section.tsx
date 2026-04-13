import { SidebarSectionShell } from "@/components/shared/sidebar-section-shell";
import type { SidebarFeedSectionViewProps } from "./sidebar.types";

export function SidebarFeedSection({ title, isOpen, onToggle }: SidebarFeedSectionViewProps) {
  return <SidebarSectionShell title={title} isOpen={isOpen} onToggle={onToggle} />;
}
