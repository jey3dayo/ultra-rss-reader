export const STORYBOOK_EXPLORER_GROUPS = {
  uiReference: "UI Reference",
  shared: "Shared",
  primitives: "Primitives",
  settings: "Settings",
  reader: "Reader",
  subscriptions: "Subscriptions",
  internal: "Internal",
} as const;

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
  shared: ["Layout", "Fields", "Rows", "Controls", "Dialogs", "Navigation", "Feedback"],
  settings: ["Page", "Section", "Nav"],
  reader: ["Article", "Sidebar", "Dialog", "Menu", "Browser"],
  subscriptions: ["Summary", "List", "Detail"],
  internal: ["Debug", "Review"],
} as const;

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
