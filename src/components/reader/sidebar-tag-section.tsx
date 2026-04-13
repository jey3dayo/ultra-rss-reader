import type { SidebarTagListProps } from "./sidebar-tag-items.types";
import { TagListView } from "./tag-list-view";

export function SidebarTagSection(props: SidebarTagListProps) {
  return <TagListView {...props} />;
}
