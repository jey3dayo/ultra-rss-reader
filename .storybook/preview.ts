import type { Preview } from "@storybook/react-vite";
import { STORYBOOK_EXPLORER_ORDER } from "../src/constants/storybook-explorer";
import "../src/lib/i18n";
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

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: STORYBOOK_PREVIEW_BACKGROUNDS,
    },
    options: {
      storySort: {
        method: "alphabetical",
        order: STORYBOOK_EXPLORER_ORDER,
      },
    },
  },
};

export default preview;
