import { useEffect, useState } from "react";
import {
  createDevIntentGenerationSnapshot,
  type DevIntent,
  isCurrentDevIntentGeneration,
  loadDevRuntimeOptions,
  readDevIntent,
} from "@/dev/intent";

type ResolvedDevIntentState = {
  intent: DevIntent;
  ready: boolean;
};

function getInitialState(): ResolvedDevIntentState {
  if (!import.meta.env.DEV) {
    return { intent: null, ready: true };
  }

  const intent = readDevIntent();
  return {
    intent,
    ready: intent !== null,
  };
}

export function useResolvedDevIntent(): ResolvedDevIntentState {
  const [state, setState] = useState<ResolvedDevIntentState>(() => getInitialState());

  useEffect(() => {
    if (!import.meta.env.DEV || state.ready) {
      return;
    }

    let cancelled = false;
    const intentGeneration = createDevIntentGenerationSnapshot();

    void loadDevRuntimeOptions().then(() => {
      if (cancelled || !isCurrentDevIntentGeneration(intentGeneration)) {
        return;
      }

      setState({
        intent: readDevIntent(),
        ready: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [state.ready]);

  return state;
}
