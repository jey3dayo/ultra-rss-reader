import type { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { Ref } from "react";

/** Public props for the app ScrollArea wrapper, including Base UI Root pass-through props. */
export type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  contentClassName?: string;
  scrollbarClassName?: string;
  thumbClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
};
