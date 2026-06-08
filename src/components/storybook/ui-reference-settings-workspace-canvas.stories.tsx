import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Palette, Settings, X } from "lucide-react";
import type { ReactNode } from "react";
import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";
import { AccountDetailView } from "@/components/settings/account-detail/view";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import { AddAccountForm } from "@/components/settings/add-account/controller";
import { SettingsNavView } from "@/components/settings/settings-nav-view";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsShellSectionLabel } from "@/components/settings/shared/settings-shell-section-label";
import { StoryQueryClientProvider } from "@/components/storybook/story-query-client-provider";
import {
  AnnotatedNote,
  ReferencePage,
  SettingsHeaderSummarySpecimen,
} from "@/components/storybook/ui-reference-settings-specimens";
import { useI18nResourceNamespace } from "@/lib/i18n/use-i18n-resource-namespace";

const settingsNavItems = [
  {
    id: "general",
    label: "General",
    icon: <Settings className="size-5" />,
    isActive: false,
  },
  {
    id: "reading",
    label: "Reading",
    icon: <BookOpen className="size-5" />,
    isActive: false,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="size-5" />,
    isActive: false,
  },
] as const;

const detailAccounts = [
  {
    id: "acc-debug",
    name: "Debug",
    kind: "freshrss",
    username: "debug",
    serverUrl: "https://demo.freshrss.example.com/api/greader.php",
    isActive: true,
  },
  {
    id: "acc-local",
    name: "Local",
    kind: "local",
    isActive: false,
  },
] as const;

const addAccountAccounts = detailAccounts.map((account) => ({
  ...account,
  isActive: false,
}));

const syncIntervalOptions = [
  { value: "900", label: "Every 15 minutes" },
  { value: "3600", label: "Every hour" },
  { value: "7200", label: "Every 2 hours" },
];

const keepReadItemsOptions = [
  { value: "30", label: "One month" },
  { value: "90", label: "Three months" },
  { value: "0", label: "Forever" },
];

function SettingsWorkspaceShell({
  title,
  accounts,
  isAddAccountActive,
  content,
  testId,
}: {
  title: string;
  accounts: ReadonlyArray<{
    id: string;
    name: string;
    kind: string;
    username?: string | null;
    serverUrl?: string | null;
    isActive: boolean;
  }>;
  isAddAccountActive: boolean;
  content: ReactNode;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="grid min-h-[780px] overflow-hidden rounded-xl border border-border/70 bg-popover shadow-elevation-3 lg:grid-cols-[292px_minmax(0,1fr)]"
    >
      <div
        className="flex min-h-0 flex-col border-b border-border/80 lg:border-r lg:border-b-0"
        style={{ backgroundColor: "var(--settings-shell-rail)" }}
      >
        <div
          className="flex min-h-[4.5rem] items-center gap-3 border-b border-border/80 px-5"
          style={{ backgroundColor: "var(--settings-shell-rail)" }}
        >
          <SettingsActionButton size="icon" tone="rail" aria-label="Close settings">
            <X className="size-4" />
          </SettingsActionButton>
          <div className="min-w-0">
            <h3 className="font-sans text-[15px] font-medium tracking-[-0.01em] text-sidebar-foreground">{title}</h3>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <SettingsNavView
            ariaLabel="Reference settings sections"
            items={settingsNavItems.map((item) => ({ ...item }))}
            onSelectCategory={() => {}}
          />
        </div>

        <div
          className="mx-3 mb-3 rounded-md border border-border/60 p-3"
          style={{ backgroundColor: "var(--settings-shell-account-surface)" }}
        >
          <SettingsShellSectionLabel>Accounts</SettingsShellSectionLabel>
          <AccountsNavView
            accounts={[...accounts]}
            addAccountLabel="Add account…"
            isAddAccountActive={isAddAccountActive}
            onSelectAccount={() => {}}
            onAddAccount={() => {}}
          />
        </div>
      </div>

      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ backgroundColor: "var(--settings-shell-content)" }}
      >
        {content}
      </div>
    </div>
  );
}

export function SettingsWorkspaceCanvas() {
  const settingsResourcesReady = useI18nResourceNamespace("settings");

  if (!settingsResourcesReady) {
    return (
      <ReferencePage maxWidthClassName="max-w-[1180px]">
        <div className="min-h-[12rem] rounded-md border border-border/70 bg-surface-1/84 p-4 shadow-none" />
      </ReferencePage>
    );
  }

  return (
    <StoryQueryClientProvider>
      <ReferencePage maxWidthClassName="max-w-[1180px]">
        <div className="space-y-4">
          <AnnotatedNote
            title="Settings workspace"
            body="This canvas is the interface reference for the settings modal as a whole: left rail, account stack, header summary, right-side control rail, and add-account flow should be judged here together."
          />
          <div className="rounded-md border border-border/70 bg-surface-1/84 p-4 shadow-none">
            <p className="font-sans text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
              Settings actions
            </p>
            <p className="mt-1 font-serif text-sm leading-[1.45] text-foreground/68">
              Shell close stays borderless in the rail. Content-side secondary actions use a quiet filled treatment so
              they remain visible without feeling like heavy outline buttons.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SettingsActionButton size="icon" tone="rail" aria-label="Close settings">
                <X className="size-4" />
              </SettingsActionButton>
              <SettingsActionButton>Reset to defaults</SettingsActionButton>
              <SettingsActionButton>Open log directory</SettingsActionButton>
            </div>
          </div>
          <SettingsHeaderSummarySpecimen />

          <div className="grid gap-6">
            <div className="space-y-3">
              <div className="px-1">
                <p className="font-sans text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
                  Account detail state
                </p>
                <p className="mt-1 font-serif text-sm leading-[1.45] text-foreground/68">
                  Verified account detail with credentials, sync controls, and a single primary action rail.
                </p>
              </div>
              <SettingsWorkspaceShell
                testId="reference-settings-workspace-detail-shell"
                title="Settings"
                accounts={detailAccounts}
                isAddAccountActive={false}
                content={
                  <AccountDetailView
                    title="Debug"
                    headerSummary={
                      <AccountConnectionSummary statusLabel="Verified" statusTone="success" detail="Today 12:55" />
                    }
                    generalSection={{
                      heading: "General",
                      nameLabel: "Description",
                      nameValue: "Debug",
                      editNameTitle: "Click to edit",
                      isEditingName: false,
                      nameDraft: "Debug",
                      infoRows: [{ label: "Type", value: "FreshRSS" }],
                      onStartEditingName: () => {},
                      onNameDraftChange: () => {},
                      onCommitName: () => {},
                      onNameKeyDown: () => {},
                    }}
                    credentialsSection={
                      <AccountCredentialsSectionView
                        heading="Server"
                        serverUrlLabel="Server URL"
                        serverUrlValue="https://demo.freshrss.example.com/api/greader.php"
                        serverUrlPlaceholder="https://your-freshrss.com"
                        serverUrlCopyLabel="Copy Server URL"
                        usernameLabel="Username"
                        usernameValue="debug"
                        passwordLabel="Password"
                        passwordValue="••••••••"
                        passwordPlaceholder="Enter new password"
                        testConnectionLabel="Test Connection"
                        testingConnectionLabel="Testing…"
                        onServerUrlChange={() => {}}
                        onServerUrlBlur={() => {}}
                        onServerUrlCopy={() => {}}
                        onUsernameChange={() => {}}
                        onUsernameBlur={() => {}}
                        onPasswordChange={() => {}}
                        onPasswordFocus={() => {}}
                        onPasswordBlur={() => {}}
                        onTestConnection={() => {}}
                      />
                    }
                    syncSection={{
                      heading: "Syncing",
                      syncInterval: {
                        name: "sync-interval",
                        label: "Sync",
                        value: "3600",
                        options: syncIntervalOptions,
                        onChange: () => {},
                      },
                      syncOnStartup: {
                        label: "Sync on startup",
                        checked: true,
                        onChange: () => {},
                      },
                      syncOnWake: {
                        label: "Sync on wake",
                        checked: false,
                        onChange: () => {},
                      },
                      keepReadItems: {
                        name: "keep-read-items",
                        label: "Keep read items",
                        value: "30",
                        options: keepReadItemsOptions,
                        onChange: () => {},
                      },
                      syncNowLabel: "Sync Now",
                      syncingLabel: "Syncing…",
                      onSyncNow: () => {},
                      statusRows: [
                        { label: "Next automatic retry", value: "Today 13:20" },
                        { label: "Last sync error", value: "No recent errors" },
                      ],
                    }}
                    dangerZone={{
                      dataHeading: "Data",
                      dangerHeading: "Danger Zone",
                      importLabel: "Import OPML",
                      exportLabel: "Export OPML",
                      deleteLabel: "Delete account",
                      onImport: () => {},
                      onExport: () => {},
                      onRequestDelete: () => {},
                    }}
                  />
                }
              />
            </div>

            <div className="space-y-3">
              <div className="px-1">
                <p className="font-sans text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase">
                  Add-account state
                </p>
                <p className="mt-1 font-serif text-sm leading-[1.45] text-foreground/68">
                  FreshRSS onboarding should still sit inside the same shell and right-side content discipline.
                </p>
              </div>
              <SettingsWorkspaceShell
                testId="reference-settings-workspace-add-shell"
                title="Settings"
                accounts={addAccountAccounts}
                isAddAccountActive={true}
                content={
                  <AddAccountForm
                    initialKind="FreshRss"
                    debugState={{
                      name: "FreshRSS",
                      serverUrl: "https://freshrss.example.com",
                      username: "alice",
                      password: "secret",
                      submitMessage:
                        "Storybook preview does not submit real accounts. Use the desktop app to test registration.",
                    }}
                  />
                }
              />
            </div>
          </div>
        </div>
      </ReferencePage>
    </StoryQueryClientProvider>
  );
}

const meta = {
  title: "UI Reference/Settings Workspace Canvas",
  component: SettingsWorkspaceCanvas,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SettingsWorkspaceCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
