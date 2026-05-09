import { z } from "zod";

export const PreferencesDtoSchema = z.record(z.string(), z.string()).superRefine((preferences, context) => {
  for (const key of Object.keys(preferences)) {
    if (key.trim().length === 0) {
      context.addIssue({
        code: "custom",
        message: "Preference key must not be blank",
        path: [key],
      });
    }
  }
});

export type PreferencesDto = z.output<typeof PreferencesDtoSchema>;
