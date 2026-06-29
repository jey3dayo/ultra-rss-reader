import type { DevIntent } from "@/dev/intent";

type ResolvedDevIntentState = {
  intent: DevIntent;
  ready: boolean;
};

const PROD_RESOLVED_DEV_INTENT: ResolvedDevIntentState = {
  intent: null,
  ready: true,
};

export function useResolvedDevIntent(): ResolvedDevIntentState {
  return PROD_RESOLVED_DEV_INTENT;
}
