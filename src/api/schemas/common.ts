import * as v from "valibot";

export const COUNT_RESPONSE_MAX_VALUE = Number.MAX_SAFE_INTEGER;

const createNonnegativeSafeIntegerSchema = () =>
  v.pipe(v.number(), v.integer(), v.minValue(0), v.finite(), v.maxValue(COUNT_RESPONSE_MAX_VALUE));

const ISO_DATE_TIME_WITH_OFFSET_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;

export const IsoDateTimeStringSchema = v.pipe(v.string(), v.regex(ISO_DATE_TIME_WITH_OFFSET_PATTERN));

export const NullResponseSchema = v.null_();
export const IntResponseSchema = v.pipe(v.number(), v.integer(), v.finite());
export const NonnegativeIntegerSchema = createNonnegativeSafeIntegerSchema();
export const NonnegativeIntResponseSchema = createNonnegativeSafeIntegerSchema();
export const CountResponseSchema = createNonnegativeSafeIntegerSchema();
export const StringResponseSchema = v.string();
export const BooleanResponseSchema = v.boolean();
