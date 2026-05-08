import { useEffect, useReducer } from "react";
import { useCommandSearch } from "@/hooks/use-command-search";
import { loadRuntimeDevScenarios, type RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import type { UseCommandPaletteRuntimeParams, UseCommandPaletteRuntimeResult } from "../../command-palette.types";

type CommandPaletteRuntimeState = {
  input: string;
  devScenarios: RuntimeDevScenario[];
};

type CommandPaletteRuntimeAction =
  | { type: "set-input"; value: string }
  | { type: "reset-input" }
  | { type: "set-dev-scenarios"; value: RuntimeDevScenario[] };

const initialCommandPaletteRuntimeState: CommandPaletteRuntimeState = {
  input: "",
  devScenarios: [],
};

function commandPaletteRuntimeReducer(
  state: CommandPaletteRuntimeState,
  action: CommandPaletteRuntimeAction,
): CommandPaletteRuntimeState {
  switch (action.type) {
    case "set-input":
      return { ...state, input: action.value };
    case "reset-input":
      return { ...state, input: "" };
    case "set-dev-scenarios":
      return { ...state, devScenarios: action.value };
    default:
      return state;
  }
}

export function useCommandPaletteRuntime({ open }: UseCommandPaletteRuntimeParams): UseCommandPaletteRuntimeResult {
  const [state, dispatch] = useReducer(commandPaletteRuntimeReducer, initialCommandPaletteRuntimeState);
  const { input, devScenarios } = state;
  const { prefix, query, deferredQuery } = useCommandSearch(input);

  useEffect(() => {
    if (!open) {
      dispatch({ type: "reset-input" });
    }
  }, [open]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    let cancelled = false;

    void loadRuntimeDevScenarios()
      .then((scenarios) => {
        if (!cancelled) {
          dispatch({ type: "set-dev-scenarios", value: scenarios });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: "set-dev-scenarios", value: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    input,
    setInput: (value) => dispatch({ type: "set-input", value }),
    devScenarios,
    prefix,
    query,
    deferredQuery,
  };
}
