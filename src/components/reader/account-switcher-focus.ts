import type { RefObject } from "react";
import { focusRovingButton } from "@/lib/dom/roving-focus";

export function focusAccountItem(
  itemRefs: RefObject<Array<HTMLButtonElement | null>>,
  accountsLength: number,
  index: number,
) {
  focusRovingButton(itemRefs, accountsLength, index);
}
