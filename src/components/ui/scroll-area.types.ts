import type { ComponentProps, Ref } from "react";

/** Public props for the app ScrollArea wrapper, backed by a native scroll viewport. */
export type ScrollAreaProps = ComponentProps<"div"> & {
  contentClassName?: string;
  scrollbarClassName?: string;
  thumbClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
};
