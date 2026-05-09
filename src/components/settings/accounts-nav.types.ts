type AccountNavSelectHandler = (accountId: string) => void;

export type AccountNavItem = {
  id: string;
  name: string;
  kind: string;
  username?: string | null;
  serverUrl?: string | null;
  isActive: boolean;
};

export type AccountsNavViewProps = {
  accounts: AccountNavItem[];
  addAccountLabel: string;
  isAddAccountActive: boolean;
  onSelectAccount: AccountNavSelectHandler;
  onAddAccount: () => void;
  disabled?: boolean;
};
