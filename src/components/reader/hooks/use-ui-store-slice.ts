import { useShallow } from "zustand/react/shallow";
import { type UiStoreState, useUiStore } from "@/stores/ui-store";

export function createUiStoreSliceHook<TResult>(selectSlice: (state: UiStoreState) => TResult) {
  return function useUiStoreSlice() {
    return useUiStore(useShallow(selectSlice));
  };
}
