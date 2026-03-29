import { z } from "zod";

export const DiscoveredFeedDtoSchema = z.object({
  url: z.string(),
  title: z.string(),
});

export type DiscoveredFeedDto = z.infer<typeof DiscoveredFeedDtoSchema>;
