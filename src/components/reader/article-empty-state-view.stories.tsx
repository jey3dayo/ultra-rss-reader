import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleEmptyStateView } from "./article-empty-state-view";

type EmptyStateScenario = "default" | "no-accounts" | "no-feeds";
type ArticleEmptyStateStoryProps = {
  scenario: EmptyStateScenario;
};

function getScenarioContent(scenario: EmptyStateScenario) {
  if (scenario === "no-accounts") {
    return {
      eyebrow: "Getting started",
      message: "Add your first account",
      description: "You can jump straight into account setup from here and start syncing right away.",
      hints: [
        'Use "Add an account to get started" in the sidebar.',
        "Open Add Account in Settings to get started right away.",
      ],
      actions: [{ label: "Add account…", onClick: () => {} }],
    };
  }

  if (scenario === "no-feeds") {
    return {
      eyebrow: "Feed setup",
      message: "Add your first feed",
      description: "Your account is ready. Add the first feed and the reading queue will come to life.",
      hints: [
        "Use the + button in the top-left to add a feed.",
        "Paste a site URL or feed URL to discover feeds automatically.",
      ],
      actions: [{ label: "Add Feed", onClick: () => {} }],
    };
  }

  return {
    eyebrow: "Reader ready",
    message: "Select an article to read",
    description: "Choose a scope on the left, then open something from the middle queue to start reading.",
    hints: ["Choose an article from the list", "Open Web Preview from the toolbar"],
    actions: [],
  };
}

function ArticleEmptyStateStory({ scenario }: ArticleEmptyStateStoryProps) {
  const content = getScenarioContent(scenario);
  return (
    <ArticleEmptyStateView
      eyebrow={content.eyebrow}
      message={content.message}
      description={content.description}
      hints={content.hints}
      actions={content.actions}
    />
  );
}

const meta = {
  title: "Reader/Article/ArticleEmptyStateView",
  component: ArticleEmptyStateStory,
  tags: ["autodocs"],
  args: {
    scenario: "default" as EmptyStateScenario,
  },
  argTypes: {
    scenario: {
      control: "select",
      options: ["default", "no-accounts", "no-feeds"],
    },
  },
  decorators: [
    (Story) => (
      <div className="flex h-[320px] bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleEmptyStateStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoAccounts: Story = {
  args: {
    scenario: "no-accounts",
  },
};

export const NoFeeds: Story = {
  args: {
    scenario: "no-feeds",
  },
};

export const Playground: Story = {};
