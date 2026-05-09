import { z } from "zod";

export const PreferencesDtoSchema = z.record(z.string(), z.string());

export type PreferencesDto = z.output<typeof PreferencesDtoSchema>;
