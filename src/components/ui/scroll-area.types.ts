import type { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { Ref } from "react";

export type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  contentClassName?: string;
  scrollbarClassName?: string;
  thumbClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
};
