export const STORYBOOK_EXPLORER_GROUPS = {
  uiReference: "UI Reference",
  shared: "Shared",
  primitives: "Primitives",
  settings: "Settings",
  reader: "Reader",
  subscriptions: "Subscriptions",
  internal: "Internal",
} as const;

export type StorybookExplorerGroup = (typeof STORYBOOK_EXPLORER_GROUPS)[keyof typeof STORYBOOK_EXPLORER_GROUPS];

export const STORYBOOK_EXPLORER_TOP_LEVEL_GROUPS = Object.values(STORYBOOK_EXPLORER_GROUPS);

export const STORYBOOK_EXPLORER_SUBGROUPS = {
  uiReference: [
    "Foundations Canvas",
    "Input Controls Canvas",
    "Button Controls Canvas",
    "Shell & Overlay Canvas",
    "Settings Workspace Canvas",
    "Navigation & Collections Canvas",
    "View Specimens Canvas",
  ],
  shared: ["Layout", "Inputs", "Rows", "Controls", "Dialogs", "Navigation", "Feedback", "Data Display"],
  settings: ["Shell", "Category", "Account", "Section", "Nav"],
  reader: ["Article List", "Article", "Sidebar", "Dialog", "Menu", "Browser"],
  subscriptions: ["Summary", "List", "Detail"],
  internal: ["Debug", "Review"],
} as const;

export function storybookExplorerTitle(group: StorybookExplorerGroup, subgroup: string, title?: string): string {
  return title === undefined ? `${group}/${subgroup}` : `${group}/${subgroup}/${title}`;
}

export const STORYBOOK_EXPLORER_UI_REFERENCE_TITLES = STORYBOOK_EXPLORER_SUBGROUPS.uiReference.map((title) =>
  storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.uiReference, title),
);

export const STORYBOOK_EXPLORER_ORDER = [
  STORYBOOK_EXPLORER_GROUPS.uiReference,
  STORYBOOK_EXPLORER_SUBGROUPS.uiReference,
  STORYBOOK_EXPLORER_GROUPS.shared,
  STORYBOOK_EXPLORER_SUBGROUPS.shared,
  STORYBOOK_EXPLORER_GROUPS.primitives,
  STORYBOOK_EXPLORER_GROUPS.settings,
  STORYBOOK_EXPLORER_SUBGROUPS.settings,
  STORYBOOK_EXPLORER_GROUPS.reader,
  STORYBOOK_EXPLORER_SUBGROUPS.reader,
  STORYBOOK_EXPLORER_GROUPS.subscriptions,
  STORYBOOK_EXPLORER_SUBGROUPS.subscriptions,
  STORYBOOK_EXPLORER_GROUPS.internal,
  STORYBOOK_EXPLORER_SUBGROUPS.internal,
] as const;
