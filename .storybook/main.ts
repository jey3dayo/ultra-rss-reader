import path from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/react-vite",
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@": path.resolve(import.meta.dirname, "../src"),
          "@tests": path.resolve(import.meta.dirname, "../tests"),
        },
      },
    });
  },
};

export default config;
