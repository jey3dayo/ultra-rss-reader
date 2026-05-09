import { z } from "zod";

const createNonnegativeIntegerSchema = () => z.number().int().nonnegative().finite();

export const IsoDateTimeStringSchema = z.string().datetime({ offset: true });

export const NullResponseSchema = z.null();
export const IntResponseSchema = z.number().int().finite();
export const NonnegativeIntegerSchema = createNonnegativeIntegerSchema();
export const NonnegativeIntResponseSchema = createNonnegativeIntegerSchema();
export const CountResponseSchema = createNonnegativeIntegerSchema();
export const StringResponseSchema = z.string();
export const BooleanResponseSchema = z.boolean();
