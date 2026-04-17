import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { BrowserDebugGeometryRow } from "@/lib/browser-debug-geometry";
import { FocusDebugHudView } from "./focus-debug-hud-view";

const sampleTraces = [
  "11:15:52.616 raw-key v target=div | article=art-2 | role=option | label=Second Article",
  "11:15:52.616 window-key v -> emit",
  "native-accelerator vk=27 ctrl=false shift=false action=close-browser grace=false handled=true",
  "11:15:53.815 menu-action close-browser",
  "11:15:53.815 close-browser start",
  "11:15:53.908 close-browser finalize",
  "11:15:53.927 flush none",
  "11:15:54.380 raw-key j target=div | article=art-2 | role=option | label=Second Article",
  "11:15:54.380 window-key j -> navigate-article",
];

const sampleGeometryRows: BrowserDebugGeometryRow[] = [
  { label: "viewport", value: "1274 x 801" },
  { label: "host", value: "1274 x 745" },
  { label: "fill", value: "100.0% 93.0%" },
  { label: "lane", value: "L0 T56 R0 B0" },
  { label: "rust", value: "create x1.10" },
  { label: "native", value: "1547 x 905" },
  { label: "match", value: "121.4% 121.4%" },
];

const meta = {
  title: "Internal/Debug/FocusDebugHudView",
  component: FocusDebugHudView,
  tags: ["autodocs"],
  args: {
    focusedPane: "content",
    contentMode: "reader",
    selectedArticleId: "art-2",
    browserCloseInFlight: false,
    pendingBrowserCloseAction: null,
    activeElementDescription: "div | article=art-2 | role=option | label=Second Article",
    browserGeometryRows: sampleGeometryRows,
    traces: sampleTraces,
    onCopyClick: fn(),
    onCopyPointerDown: fn(),
    defaultExpanded: false,
    defaultShowGeometry: false,
  },
  decorators: [
    (Story) => (
      <div className="relative h-[560px] w-full max-w-[640px] overflow-hidden bg-[#09090b] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FocusDebugHudView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closing: Story = {
  args: {
    browserCloseInFlight: true,
    pendingBrowserCloseAction: "next-article",
    defaultExpanded: true,
    traces: [
      "11:15:53.815 menu-action close-browser",
      "11:15:53.815 close-browser start",
      "11:15:53.842 queue next-article",
      "11:15:53.908 close-browser finalize",
      "11:15:53.927 flush next-article",
    ],
  },
};

export const EmptyTrace: Story = {
  args: {
    selectedArticleId: null,
    activeElementDescription: "none",
    browserGeometryRows: [],
    traces: [],
  },
};

export const LongJapaneseGeometry: Story = {
  args: {
    defaultExpanded: true,
    defaultShowGeometry: true,
    selectedArticleId: "70781cf0-19a3-4d98-b6be-cd11a3cefdd3:tag:google.com,2005:reader/item/00064ece7c8032fc",
    activeElementDescription:
      "div | article=70781cf0-19a3-4d98-b6be-cd11a3cefdd3:tag:google.com,2005:reader/item/00064ece7c8032fc | role=option | label=我々が築き、掘っている未来",
    browserGeometryRows: [
      { label: "viewport", value: "1274 x 801" },
      { label: "host", value: "1274 x 745" },
      { label: "fill", value: "100.0% 93.0%" },
      { label: "lane", value: "L0 T56 R0 B0" },
      { label: "native", value: "1547 x 905" },
      { label: "match", value: "121.4% 121.4%" },
    ],
    traces: sampleTraces,
  },
};

export const CollapsedLongJapanese: Story = {
  args: {
    defaultExpanded: false,
    selectedArticleId: "70781cf0-19a3-4d98-b6be-cd11a3cefdd3:tag:google.com,2005:reader/item/00064ece7c8032fc",
    activeElementDescription:
      "div | article=70781cf0-19a3-4d98-b6be-cd11a3cefdd3:tag:google.com,2005:reader/item/00064ece7c8032fc | role=option | label=我々が築き、掘っている未来",
    traces: [
      "11:15:53.815 menu-action close-browser",
      "11:15:53.908 close-browser finalize",
      "11:15:54.380 window-key j -> navigate-article",
    ],
  },
};
