import type { DevIntent } from "@/dev/intent";

export type DevIntentState = {
  intent: DevIntent;
};

export function createDevIntentState(): DevIntentState {
  return { intent: null };
}

export function resetDevIntentState(state: DevIntentState): void {
  state.intent = null;
}
