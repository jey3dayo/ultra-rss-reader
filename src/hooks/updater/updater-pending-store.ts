import { create } from "zustand";

export type PendingKind = "restart" | "download";
export type PendingState =
  | { status: "idle" }
  | { status: "attempting" | "waiting"; kind: PendingKind; version: string; requestId: number }
  | { status: "failed"; kind: PendingKind; version: string; reason: string; requestId: number };

export const useUpdaterPendingStore = create<{ pending: PendingState }>(() => ({ pending: { status: "idle" } }));
