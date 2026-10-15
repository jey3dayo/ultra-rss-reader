import type { ComponentProps, Ref } from "react";

/** Public props for the app ScrollArea wrapper, backed by a native scroll viewport. */
export type ScrollAreaProps = ComponentProps<"div"> & {
  contentClassName?: string;
  /** Puts the viewport in the tab order, only while its content overflows, so keyboard users can scroll it. */
  keyboardScrollable?: boolean;
  scrollbarClassName?: string;
  thumbClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
};
