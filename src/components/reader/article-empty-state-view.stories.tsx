import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { readerPassiveCardOffsetClassName } from "./reader-passive-card";

type EmptyStateScenario = "default" | "no-accounts" | "no-feeds";
type ArticleEmptyStateStoryProps = {
  scenario: EmptyStateScenario;
};

function getScenarioContent(scenario: EmptyStateScenario) {
  if (scenario === "no-accounts") {
    return {
      eyebrow: "Getting started",
      message: "Add your first account",
      description: "Add an account first to get subscriptions and sync ready.",
      hints: [],
      containerClassName: undefined,
      cardClassName: undefined,
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
      containerClassName: undefined,
      cardClassName: undefined,
      actions: [{ label: "Add Feed", onClick: () => {} }],
    };
  }

  return {
    eyebrow: undefined,
    message: "Select an article to read",
    description: "Choose a scope on the left, then open something from the middle queue to start reading.",
    hints: ["Choose an article from the list", "Open Web Preview from the toolbar"],
    containerClassName: readerPassiveCardOffsetClassName,
    cardClassName: undefined,
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
      containerClassName={content.containerClassName}
      cardClassName={content.cardClassName}
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
