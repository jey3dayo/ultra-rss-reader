import { SidebarSectionShell } from "@/components/shared/sidebar-section-shell";

type SidebarFeedSectionProps = {
  title: string;
  isSectionOpen: boolean;
  onToggleSection: () => void;
};

export function SidebarFeedSection({ title, isSectionOpen, onToggleSection }: SidebarFeedSectionProps) {
  return <SidebarSectionShell title={title} isOpen={isSectionOpen} onToggle={onToggleSection} />;
}
