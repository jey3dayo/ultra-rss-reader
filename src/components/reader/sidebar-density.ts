export type SidebarDensity = "compact" | "normal" | "spacious";

export type SidebarDensityTokens = {
  navButton: string;
  dragHandle: string;
  folderToggle: string;
  dragPadding: string;
  treeGap: string;
  childGap: string;
  unfolderedGap: string;
  tagListGap: string;
};

const densityMap: Record<SidebarDensity, SidebarDensityTokens> = {
  compact: {
    navButton: "min-h-8 py-0.5",
    dragHandle: "h-8 w-8",
    folderToggle: "h-8 w-8",
    dragPadding: "pl-8",
    treeGap: "space-y-0",
    childGap: "space-y-0",
    unfolderedGap: "space-y-1",
    tagListGap: "space-y-0",
  },
  normal: {
    navButton: "min-h-9 py-1",
    dragHandle: "h-9 w-9",
    folderToggle: "h-9 w-9",
    dragPadding: "pl-9",
    treeGap: "space-y-0.5",
    childGap: "space-y-0.5",
    unfolderedGap: "space-y-1.5",
    tagListGap: "space-y-0.5",
  },
  spacious: {
    navButton: "min-h-10 py-1.5",
    dragHandle: "h-10 w-10",
    folderToggle: "h-10 w-10",
    dragPadding: "pl-10",
    treeGap: "space-y-1",
    childGap: "space-y-1",
    unfolderedGap: "space-y-2",
    tagListGap: "space-y-1",
  },
};

export function getSidebarDensityTokens(density: SidebarDensity): SidebarDensityTokens {
  return densityMap[density];
}
