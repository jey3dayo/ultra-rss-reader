import { z } from "zod";

export const BrowserWebviewStateSchema = z
  .object({
    url: z.string(),
    can_go_back: z.boolean(),
    can_go_forward: z.boolean(),
    is_loading: z.boolean(),
  })
  .strict();

export type BrowserWebviewState = z.output<typeof BrowserWebviewStateSchema>;
