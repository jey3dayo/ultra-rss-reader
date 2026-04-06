import { SidebarSectionShell } from "@/components/shared/sidebar-section-shell";

type SidebarFeedSectionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function SidebarFeedSection({ title, isOpen, onToggle }: SidebarFeedSectionProps) {
  return <SidebarSectionShell title={title} isOpen={isOpen} onToggle={onToggle} />;
}
