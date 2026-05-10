import type { Preview } from "@storybook/react-vite";
import i18n from "../src/lib/i18n";
import "../src/styles/global.css";

type StorybookPreviewBackgroundName = "dark" | "light";

type StorybookPreviewBackground = {
  name: StorybookPreviewBackgroundName;
  value: string;
};

export const STORYBOOK_PREVIEW_BACKGROUND_TOKEN = "--theme-canvas";

export const STORYBOOK_PREVIEW_BACKGROUND_VALUES: Record<StorybookPreviewBackgroundName, string> = {
  dark: "#1c1915",
  light: "#f2f1ed",
};

export const STORYBOOK_PREVIEW_BACKGROUNDS: StorybookPreviewBackground[] = [
  {
    name: "dark",
    value: STORYBOOK_PREVIEW_BACKGROUND_VALUES.dark,
  },
  {
    name: "light",
    value: STORYBOOK_PREVIEW_BACKGROUND_VALUES.light,
  },
];

i18n.options.parseMissingKeyHandler = (key: string): never => {
  throw new Error(`Missing i18n key in Storybook runtime: ${key}`);
};

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: STORYBOOK_PREVIEW_BACKGROUNDS,
    },
    options: {
      storySort: {
        method: "alphabetical",
        order: [
          "UI Reference",
          [
            "Foundations Canvas",
            "Input Controls Canvas",
            "Button Controls Canvas",
            "Shell & Overlay Canvas",
            "Settings Workspace Canvas",
            "Navigation & Collections Canvas",
            "View Specimens Canvas",
          ],
          "Shared",
          ["Layout", "Fields", "Rows", "Controls", "Dialogs", "Navigation", "Feedback"],
          "Primitives",
          "Settings",
          ["Page", "Section", "Nav"],
          "Reader",
          ["Article", "Sidebar", "Dialog", "Menu", "Browser"],
          "Subscriptions",
          ["Summary", "List", "Detail"],
          "Internal",
          ["Debug", "Review"],
        ],
      },
    },
  },
};

export default preview;
