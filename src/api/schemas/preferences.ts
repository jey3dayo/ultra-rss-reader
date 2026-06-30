import { z } from "zod";
import {
  isReservedUnknownPreferenceKey,
  isRetiredBackendPassthroughPreferenceKey,
  isValidPreferenceValue,
  preferenceKeyMaxLength,
  preferenceValueMaxUtf8Bytes,
} from "@/schemas/preference-values";

const textEncoder = new TextEncoder();

export const PreferencesDtoSchema = z.record(z.string(), z.string()).superRefine((preferences, context) => {
  for (const [key, value] of Object.entries(preferences)) {
    if (key.trim().length === 0) {
      context.addIssue({
        code: "custom",
        message: "Preference key must not be blank",
        path: [key],
      });
    }

    if (key.length > preferenceKeyMaxLength) {
      context.addIssue({
        code: "custom",
        message: `Preference key must be ${preferenceKeyMaxLength} characters or less`,
        path: [key],
      });
    }

    if (isReservedUnknownPreferenceKey(key)) {
      context.addIssue({
        code: "custom",
        message: `Unknown preference key uses a reserved prefix: ${key}`,
        path: [key],
      });
    }

    if (isRetiredBackendPassthroughPreferenceKey(key)) {
      context.addIssue({
        code: "custom",
        message: `Preference key is retired: ${key}`,
        path: [key],
      });
    }

    if (!isValidPreferenceValue(key, value)) {
      context.addIssue({
        code: "custom",
        message: `Invalid value for preference key: ${key}`,
        path: [key],
      });
    }

    if (textEncoder.encode(value).length > preferenceValueMaxUtf8Bytes) {
      context.addIssue({
        code: "custom",
        message: `Preference value must be ${preferenceValueMaxUtf8Bytes} UTF-8 bytes or less`,
        path: [key],
      });
    }
  }
});

export type PreferencesDto = z.output<typeof PreferencesDtoSchema>;
