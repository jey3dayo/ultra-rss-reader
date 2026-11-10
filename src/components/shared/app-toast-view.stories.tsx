import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, type ReactNode, useLayoutEffect } from "react";
import { expect, fn, within } from "storybook/test";
import { denseNarrowViewportParameters } from "@/components/storybook/viewport-fixtures";
import { READER_CHROME_HEIGHT_PX } from "@/constants/ui-layout";
import { APP_TOAST_PLACEMENTS } from "./app-toast-placement";
import { AppToastView } from "./app-toast-view";

function ThemeRoot({ dark, children }: { dark: boolean; children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousDark = root.classList.contains("dark");
    const previousLanguage = root.lang;
    root.classList.toggle("dark", dark);
    root.lang = "ja";
    return () => {
      root.classList.toggle("dark", previousDark);
      root.lang = previousLanguage;
    };
  }, [dark]);
  return children;
}

const meta = {
  title: "Shared/Feedback/AppToastView",
  component: AppToastView,
  args: { onClose: fn(), position: "static" },
  decorators: [
    (Story) => (
      <div lang="ja">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppToastView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UpdateReadyDecision: Story = {
  args: {
    toastMessage: {
      message: "v0.67.2 の更新を準備しました。再起動後に適用されます",
      persistent: true,
      variant: "update",
      actions: [
        { label: "今すぐ再起動", onClick: fn() },
        { label: "後で", onClick: fn() },
      ],
    },
  },
};

export const UpdateRestartPendingAfterSync: Story = {
  args: {
    toastMessage: {
      message: "実行中の処理が終わったら、アップデートを適用して再起動します",
      persistent: true,
      variant: "update",
      actions: [{ label: "キャンセル", onClick: fn() }],
    },
  },
};

export const SingleActionInformational: Story = {
  args: {
    toastMessage: {
      message: "同期に失敗しました",
      actions: [{ label: "再試行", onClick: fn() }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toast = canvas.getByTestId("app-toast");
    await Promise.all(toast.getAnimations({ subtree: true }).map((animation) => animation.finished));
    const message = canvas.getByText("同期に失敗しました");
    const action = canvas.getByRole("button", { name: "再試行" });
    const svg = toast.querySelector("button svg");
    if (!(svg instanceof SVGSVGElement)) throw new Error("Missing close icon");
    const path = svg.querySelector("path");
    if (!path) throw new Error("Missing close icon path");
    const box = path.getBBox();
    const matrix = path.getScreenCTM();
    if (!matrix) throw new Error("Missing SVG transform");
    const paintRight = new DOMPoint(
      box.x + box.width + Number(svg.getAttribute("stroke-width")) / 2,
      box.y,
    ).matrixTransform(matrix).x;
    const bounds = toast.getBoundingClientRect();
    const leading = message.getBoundingClientRect().left - bounds.left;
    await expect(Math.abs(leading - (bounds.right - paintRight))).toBeLessThan(3);
    await expect(Math.abs(message.getBoundingClientRect().left - action.getBoundingClientRect().left)).toBeLessThan(1);
    const close = canvas.getByRole("button", { name: /close|閉じる/i }).getBoundingClientRect();
    const messageBounds = message.getBoundingClientRect();
    const firstLineCenter = messageBounds.top + Number.parseFloat(getComputedStyle(message).lineHeight) / 2;
    await expect(Math.abs(close.top + close.height / 2 - firstLineCenter)).toBeLessThan(1);
    await expect(close.width).toBe(32);
    await expect(close.height).toBe(32);
  },
};

export const ErrorSeverity: Story = {
  args: {
    toastMessage: {
      message: "同期に失敗しました",
      severity: "error",
    },
  },
};

export const WarningSeverity: Story = {
  args: {
    toastMessage: {
      message: "一部のフィードを更新できませんでした",
      severity: "warning",
    },
  },
};

export const UpdateRestarting: Story = {
  args: { hideClose: true, toastMessage: { message: "アップデートを適用して再起動しています…", variant: "update" } },
};

export const UpdatePendingWithToast: Story = {
  args: UpdateRestartPendingAfterSync.args,
  render: (args) => <PendingWithToast {...args} />,
};

function PendingWithToast(args: ComponentProps<typeof AppToastView>) {
  return (
    <div className="flex flex-col items-end gap-2">
      <AppToastView {...args} />
      <AppToastView position="static" onClose={fn()} toastMessage={{ message: "同期が完了しました" }} />
    </div>
  );
}

function NarrowToast(args: ComponentProps<typeof AppToastView>) {
  return (
    <div className="w-[min(100%,288px)] [&>div]:max-w-full">
      <AppToastView {...args} />
    </div>
  );
}

export const NarrowLongContent: Story = {
  args: {
    toastMessage: {
      message:
        "実行中の処理が終わったら、アップデートを適用して再起動します https://example.com/averylongunbrokenpaththatmustremainreadable",
      variant: "update",
      actions: [{ label: "キャンセル", onClick: fn() }],
    },
  },
  parameters: denseNarrowViewportParameters,
  render: (args) => <NarrowToast {...args} />,
  play: async ({ canvasElement }) => {
    const toast = within(canvasElement).getByTestId("app-toast");
    await Promise.all(toast.getAnimations({ subtree: true }).map((animation) => animation.finished));
    const bounds = toast.getBoundingClientRect();
    const close = within(toast)
      .getByRole("button", { name: /close|閉じる/i })
      .getBoundingClientRect();
    const action = within(toast).getByRole("button", { name: "キャンセル" }).getBoundingClientRect();
    await expect(bounds.width).toBeLessThanOrEqual(288);
    await expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
    await expect(close.right).toBeLessThanOrEqual(bounds.right);
    await expect(action.right).toBeLessThanOrEqual(bounds.right);
    await expect(toast.scrollWidth).toBeLessThanOrEqual(toast.clientWidth);
  },
};

export const Progress: Story = {
  args: { toastMessage: { message: "アップデートをダウンロード中", variant: "update", progress: 43 } },
};

export const NeutralSeverities: Story = {
  args: { toastMessage: { message: "保存しました" } },
  render: (args) => <NeutralToastGroup {...args} />,
};

function NeutralToastGroup(args: ComponentProps<typeof AppToastView>) {
  return (
    <div className="flex flex-col gap-3">
      <AppToastView {...args} toastMessage={{ message: "保存しました", severity: "success" }} />
      <AppToastView {...args} toastMessage={{ message: "同期中です", severity: "info" }} />
      <AppToastView {...args} toastMessage={{ message: "保存しました" }} />
    </div>
  );
}

export const Light: Story = {
  args: UpdateRestartPendingAfterSync.args,
  render: () => <Gallery />,
  decorators: [
    (Story) => (
      <ThemeRoot dark={false}>
        <Story />
      </ThemeRoot>
    ),
  ],
};

export const Dark: Story = {
  args: UpdateRestartPendingAfterSync.args,
  render: () => <Gallery />,
  decorators: [
    (Story) => (
      <ThemeRoot dark>
        <Story />
      </ThemeRoot>
    ),
  ],
};

export const IndeterminateProgress: Story = {
  args: { toastMessage: { message: "アップデートをダウンロード中", variant: "update", progress: null } },
};

export const BrowserRail: Story = {
  args: {
    position: "fixed",
    placement: APP_TOAST_PLACEMENTS.browserRail,
    toastMessage: { message: "同期失敗", severity: "warning" },
  },
  parameters: denseNarrowViewportParameters,
  render: (args) => (
    <div
      data-testid="rail-frame"
      className="border"
      style={{ height: READER_CHROME_HEIGHT_PX, transform: "translateZ(0)" }}
    >
      <AppToastView {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const toast = within(canvasElement).getByTestId("app-toast");
    await Promise.all(toast.getAnimations({ subtree: true }).map((animation) => animation.finished));
    const close = within(toast).getByRole("button");
    const bounds = toast.getBoundingClientRect();
    const frame = within(canvasElement).getByTestId("rail-frame").getBoundingClientRect();
    await expect(bounds.left).toBeGreaterThanOrEqual(frame.left);
    await expect(bounds.right).toBeLessThanOrEqual(frame.right - 80);
    await expect(bounds.bottom).toBeLessThanOrEqual(frame.bottom);
    await expect(close.offsetWidth).toBeGreaterThanOrEqual(32);
    const icon = within(toast).getByTestId("app-toast-severity-icon").getBoundingClientRect();
    const message = within(toast).getByText("同期失敗").getBoundingClientRect();
    const closeBounds = close.getBoundingClientRect();
    await expect(
      Math.abs((closeBounds.top + closeBounds.bottom) / 2 - (message.top + message.bottom) / 2),
    ).toBeLessThan(1);
    await expect(Math.abs((icon.top + icon.bottom) / 2 - (message.top + message.bottom) / 2)).toBeLessThan(2);
  },
};

export const SeveritySingleAction: Story = {
  args: {
    toastMessage: {
      message: "同期に失敗しました",
      severity: "error",
      actions: [{ label: "再試行", onClick: fn() }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toast = canvas.getByTestId("app-toast");
    await Promise.all(toast.getAnimations({ subtree: true }).map((animation) => animation.finished));
    const message = canvas.getByText("同期に失敗しました").getBoundingClientRect();
    const action = canvas.getByRole("button", { name: "再試行" }).getBoundingClientRect();
    await expect(Math.abs(message.left - action.left)).toBeLessThan(1);
  },
};

const galleryCases = [
  ["Update ready · two actions", UpdateReadyDecision],
  ["Update pending · one action and close", UpdateRestartPendingAfterSync],
  ["Single action · informational", SingleActionInformational],
  ["Error severity", ErrorSeverity],
  ["Warning severity", WarningSeverity],
  ["Restarting · no close", UpdateRestarting],
  ["Pending with another toast", UpdatePendingWithToast],
  ["Narrow · multiline and URL", NarrowLongContent],
  ["Determinate progress", Progress],
  ["Neutral · success, info, default", NeutralSeverities],
  ["Indeterminate progress", IndeterminateProgress],
  ["Error · single action", SeveritySingleAction],
  ["Browser rail · compact fixed", BrowserRail],
] as const;

function Gallery() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))] gap-6 bg-background p-4 text-foreground">
      {galleryCases.map(([label, story]) => {
        const args = story.args;
        if (!args?.toastMessage) return null;
        const rail = story === BrowserRail;
        return (
          <section key={label} aria-label={label} className="min-w-0 rounded-md border border-border p-3">
            <h2 className="mb-3 text-sm font-medium">{label}</h2>
            {rail ? (
              <div className="min-h-32 border border-border" style={{ transform: "translateZ(0)" }}>
                <AppToastView onClose={fn()} {...args} toastMessage={args.toastMessage} />
              </div>
            ) : story === UpdatePendingWithToast ? (
              <PendingWithToast onClose={fn()} position="static" {...args} toastMessage={args.toastMessage} />
            ) : story === NeutralSeverities ? (
              <NeutralToastGroup onClose={fn()} position="static" {...args} toastMessage={args.toastMessage} />
            ) : story === NarrowLongContent ? (
              <NarrowToast onClose={fn()} position="static" {...args} toastMessage={args.toastMessage} />
            ) : (
              <AppToastView onClose={fn()} position="static" {...args} toastMessage={args.toastMessage} />
            )}
          </section>
        );
      })}
    </div>
  );
}

export const AllVariants: Story = {
  args: UpdateRestartPendingAfterSync.args,
  render: () => <Gallery />,
};
