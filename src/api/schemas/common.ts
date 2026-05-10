import { z } from "zod";

export const COUNT_RESPONSE_MAX_VALUE = Number.MAX_SAFE_INTEGER;

const createNonnegativeSafeIntegerSchema = () => z.number().int().nonnegative().finite().max(COUNT_RESPONSE_MAX_VALUE);

export const IsoDateTimeStringSchema = z.string().datetime({ offset: true });

export const NullResponseSchema = z.null();
export const IntResponseSchema = z.number().int().finite();
export const NonnegativeIntegerSchema = createNonnegativeSafeIntegerSchema();
export const NonnegativeIntResponseSchema = createNonnegativeSafeIntegerSchema();
export const CountResponseSchema = createNonnegativeSafeIntegerSchema();
export const StringResponseSchema = z.string();
export const BooleanResponseSchema = z.boolean();
