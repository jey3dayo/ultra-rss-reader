import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleEmptyStateView } from "./article-empty-state-view";

type EmptyStateScenario = "default" | "no-accounts" | "no-feeds";
type ArticleEmptyStateStoryProps = {
  scenario: EmptyStateScenario;
};

function getScenarioContent(scenario: EmptyStateScenario) {
  if (scenario === "no-accounts") {
    return {
      message: "Add your first account",
      hints: [
        'Use "Add an account to get started" in the sidebar.',
        "Open Add Account in Settings to get started right away.",
      ],
    };
  }

  if (scenario === "no-feeds") {
    return {
      message: "Add your first feed",
      hints: [
        "Use the + button in the top-left to add a feed.",
        "Paste a site URL or feed URL to discover feeds automatically.",
      ],
    };
  }

  return {
    message: "Select an article to read",
    hints: ["Choose an article from the list", "Open Web Preview from the toolbar"],
  };
}

function ArticleEmptyStateStory({ scenario }: ArticleEmptyStateStoryProps) {
  const content = getScenarioContent(scenario);
  return <ArticleEmptyStateView message={content.message} hints={content.hints} />;
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
