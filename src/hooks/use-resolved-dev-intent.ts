import { useEffect, useState } from "react";
import { type DevIntent, loadDevRuntimeOptions, readDevIntent } from "@/lib/dev-intent";

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

    void loadDevRuntimeOptions().then(() => {
      if (cancelled) {
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
