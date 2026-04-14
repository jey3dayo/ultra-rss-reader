export type SidebarDensity = "compact" | "normal" | "spacious";

export type SidebarDensityTokens = {
  navButton: string;
  navButtonPaddingX: string;
  navButtonContentGap: string;
  leadingControl: string;
  dragPadding: string;
  treeGap: string;
  childGap: string;
  unfolderedGap: string;
  tagListGap: string;
  treeInset: string;
  sectionLabelInset: string;
};

const densityMap: Record<SidebarDensity, SidebarDensityTokens> = {
  compact: {
    navButton: "min-h-8 py-0.5",
    navButtonPaddingX: "px-1.5",
    navButtonContentGap: "gap-1.5",
    leadingControl: "h-8 w-8",
    dragPadding: "pl-8",
    treeGap: "space-y-0",
    childGap: "space-y-0",
    unfolderedGap: "space-y-1",
    tagListGap: "space-y-0",
    treeInset: "ml-1 pl-2",
    sectionLabelInset: "ml-1 px-2",
  },
  normal: {
    navButton: "min-h-9 py-1",
    navButtonPaddingX: "px-1.5",
    navButtonContentGap: "gap-1.5",
    leadingControl: "h-7 w-7",
    dragPadding: "pl-7",
    treeGap: "space-y-0.5",
    childGap: "space-y-0.5",
    unfolderedGap: "space-y-1.5",
    tagListGap: "space-y-0.5",
    treeInset: "ml-1 pl-2",
    sectionLabelInset: "ml-1 px-2",
  },
  spacious: {
    navButton: "min-h-10 py-1.5",
    navButtonPaddingX: "px-2",
    navButtonContentGap: "gap-2",
    leadingControl: "h-8 w-8",
    dragPadding: "pl-8",
    treeGap: "space-y-1",
    childGap: "space-y-1",
    unfolderedGap: "space-y-2",
    tagListGap: "space-y-1",
    treeInset: "ml-2 pl-3",
    sectionLabelInset: "ml-2 px-3",
  },
};

export function getSidebarDensityTokens(density: SidebarDensity): SidebarDensityTokens {
  return densityMap[density];
}
