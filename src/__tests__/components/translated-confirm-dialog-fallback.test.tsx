import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTranslation: (namespace?: string) => ({
    t: (key: string) => {
      const common = {
        cancel: "Cancel",
        delete: "Delete",
      };
      const reader = {
        delete_tag: "Delete Tag",
        unsubscribe: "Unsubscribe",
      };
      const dictionaries = {
        common,
        reader,
      } as const;

      return dictionaries[namespace as keyof typeof dictionaries]?.[key as never] ?? key;
    },
  }),
}));

import { DeleteTagDialogView } from "@/components/reader/delete-tag-dialog-view";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";

describe("translated destructive confirmation fallbacks", () => {
  it("renders the delete-tag fallback copy without crashing", () => {
    expect(() =>
      render(<DeleteTagDialogView open={true} tagName="Work" onOpenChange={vi.fn()} onConfirm={vi.fn()} />),
    ).not.toThrow();

    expect(screen.getByRole("dialog")).toHaveTextContent("Are you sure you want to delete Work?");
  });

  it("renders the unsubscribe fallback copy without crashing", () => {
    expect(() =>
      render(
        <UnsubscribeDialog
          feed={{ title: "Tech News" } as never}
          open={true}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByRole("dialog")).toHaveTextContent("Are you sure you want to unsubscribe from Tech News?");
  });
});
