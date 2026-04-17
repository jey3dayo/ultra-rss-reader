import type { Preview } from "@storybook/react-vite";
import "../src/lib/i18n";
import "../src/styles/global.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#09090b" },
        { name: "light", value: "#ffffff" },
      ],
    },
    options: {
      storySort: {
        method: "alphabetical",
        order: [
          "UI Reference",
          [
            "Foundations Canvas",
            "Input Controls Canvas",
            "Shell & Overlay Canvas",
            "Navigation & Collections Canvas",
            "View Specimens Canvas",
          ],
          "Shared",
          "Primitives",
          "Settings",
          ["Page", "Section", "Nav"],
          "Reader",
          ["Article", "Sidebar", "Dialog", "Menu", "Browser"],
          "Feed Cleanup",
          "Internal",
          ["Debug", "Review"],
        ],
      },
    },
  },
};

export default preview;
