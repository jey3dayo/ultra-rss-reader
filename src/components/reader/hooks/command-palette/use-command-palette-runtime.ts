import { Result } from "@praha/byethrow";
import { useEffect, useReducer, useRef } from "react";
import { useCommandSearch } from "@/components/reader/hooks/command-palette/use-command-search";
import {
  type DevScenarioRuntimeError,
  loadRuntimeDevScenariosResult,
  type RuntimeDevScenario,
} from "@/dev/scenario-runtime";

type UseCommandPaletteRuntimeParams = {
  open: boolean;
};

type UseCommandPaletteRuntimeResult = {
  input: string;
  setInput: (value: string) => void;
  devScenarios: RuntimeDevScenario[];
  devScenarioLoadError: DevScenarioRuntimeError | null;
  prefix: string | null;
  query: string;
  deferredQuery: string;
};

type CommandPaletteRuntimeState = {
  input: string;
  devScenarios: RuntimeDevScenario[];
  devScenarioLoadError: DevScenarioRuntimeError | null;
};

type CommandPaletteRuntimeAction =
  | { type: "set-input"; value: string }
  | { type: "reset-input" }
  | { type: "set-dev-scenarios"; value: RuntimeDevScenario[] }
  | { type: "set-dev-scenario-load-error"; value: DevScenarioRuntimeError };

const initialCommandPaletteRuntimeState: CommandPaletteRuntimeState = {
  input: "",
  devScenarios: [],
  devScenarioLoadError: null,
};

type CommandPaletteRuntimeDevScenarioLoadResult =
  | { ok: true; scenarios: RuntimeDevScenario[] }
  | { ok: false; error: DevScenarioRuntimeError };

async function loadCommandPaletteRuntimeDevScenarios(): Promise<CommandPaletteRuntimeDevScenarioLoadResult> {
  if (!import.meta.env.DEV) {
    return { ok: true, scenarios: [] };
  }

  const result = await loadRuntimeDevScenariosResult();
  if (Result.isFailure(result)) {
    return { ok: false, error: Result.unwrapError(result) };
  }
  return { ok: true, scenarios: Result.unwrap(result) };
}

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
      return {
        ...state,
        devScenarios: action.value,
        devScenarioLoadError: null,
      };
    case "set-dev-scenario-load-error":
      return { ...state, devScenarios: [], devScenarioLoadError: action.value };
    default:
      return state;
  }
}

export function useCommandPaletteRuntime({ open }: UseCommandPaletteRuntimeParams): UseCommandPaletteRuntimeResult {
  const [state, dispatch] = useReducer(commandPaletteRuntimeReducer, initialCommandPaletteRuntimeState);
  const openGenerationRef = useRef(0);
  const { input, devScenarios, devScenarioLoadError } = state;
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

    openGenerationRef.current += 1;
    const openGeneration = openGenerationRef.current;
    let cancelled = false;

    if (!open) {
      return () => {
        cancelled = true;
      };
    }

    void loadCommandPaletteRuntimeDevScenarios()
      .then((loadResult) => {
        if (cancelled || openGeneration !== openGenerationRef.current) {
          return;
        }

        if (loadResult.ok) {
          dispatch({ type: "set-dev-scenarios", value: loadResult.scenarios });
          return;
        }

        console.warn("Command palette dev scenario loader failed.", loadResult.error);
        dispatch({
          type: "set-dev-scenario-load-error",
          value: loadResult.error,
        });
      })
      .catch((error: unknown) => {
        if (cancelled || openGeneration !== openGenerationRef.current) {
          return;
        }

        const loadError: DevScenarioRuntimeError = {
          type: "module_load_failed",
          message:
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : "Unknown dev scenario runtime error.",
        };
        console.warn("Command palette dev scenario loader failed.", loadError);
        dispatch({ type: "set-dev-scenario-load-error", value: loadError });
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  return {
    input,
    setInput: (value) => dispatch({ type: "set-input", value }),
    devScenarios,
    devScenarioLoadError,
    prefix,
    query,
    deferredQuery,
  };
}
