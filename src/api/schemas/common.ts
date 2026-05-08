import { z } from "zod";

export const NullResponseSchema = z.null();
export const IntResponseSchema = z.number().int();
export const NonnegativeIntegerSchema = z.number().int().nonnegative();
export const StringResponseSchema = z.string();
export const BooleanResponseSchema = z.boolean();
