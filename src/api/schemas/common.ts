import { z } from "zod";

const createNonnegativeIntegerSchema = () => z.number().int().nonnegative();

export const NullResponseSchema = z.null();
export const IntResponseSchema = z.number().int();
export const NonnegativeIntegerSchema = createNonnegativeIntegerSchema();
export const NonnegativeIntResponseSchema = createNonnegativeIntegerSchema();
export const CountResponseSchema = createNonnegativeIntegerSchema();
export const StringResponseSchema = z.string();
export const BooleanResponseSchema = z.boolean();
