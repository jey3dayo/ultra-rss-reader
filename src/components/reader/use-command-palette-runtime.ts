import { useEffect, useState } from "react";
import { useCommandSearch } from "@/hooks/use-command-search";
import { loadRuntimeDevScenarios, type RuntimeDevScenario } from "@/lib/dev-scenario-runtime";

export function useCommandPaletteRuntime(open: boolean) {
  const [input, setInput] = useState("");
  const [devScenarios, setDevScenarios] = useState<RuntimeDevScenario[]>([]);
  const { prefix, query, deferredQuery } = useCommandSearch(input);

  useEffect(() => {
    if (!open) {
      setInput("");
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
          setDevScenarios(scenarios);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDevScenarios([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    input,
    setInput,
    devScenarios,
    prefix,
    query,
    deferredQuery,
  };
}
