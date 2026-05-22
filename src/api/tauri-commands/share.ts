import { addToReadingListArgs, copyToClipboardArgs, NullResponseSchema } from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const copyToClipboard = (text: string) =>
  safeInvoke("copy_to_clipboard", { response: NullResponseSchema, args: copyToClipboardArgs }, { text });

export const addToReadingList = (url: string) =>
  safeInvoke("add_to_reading_list", { response: NullResponseSchema, args: addToReadingListArgs }, { url });
