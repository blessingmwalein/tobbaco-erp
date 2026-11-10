"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ScanHistoryEntry } from "@tobacco/ui";

/** UI-only shared state (never domain state — that lives in the mock DB / future backend). */
interface UiState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  sound: boolean;
  setSound: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  /** Scan history per workspace scope, newest first. Not persisted. */
  scanHistory: Record<string, ScanHistoryEntry[]>;
  pushScan: (scope: string, entry: Omit<ScanHistoryEntry, "id" | "at">) => void;
  clearScans: (scope: string) => void;
}

let scanSeq = 0;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      sound: false,
      setSound: (v) => set({ sound: v }),
      searchOpen: false,
      setSearchOpen: (v) => set({ searchOpen: v }),
      scanHistory: {},
      pushScan: (scope, entry) =>
        set((s) => {
          const now = new Date();
          const at = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const list = [{ ...entry, id: `scan-${++scanSeq}`, at }, ...(s.scanHistory[scope] ?? [])].slice(0, 200);
          return { scanHistory: { ...s.scanHistory, [scope]: list } };
        }),
      clearScans: (scope) => set((s) => ({ scanHistory: { ...s.scanHistory, [scope]: [] } })),
    }),
    {
      name: "tobacco-erp-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, sound: s.sound }),
    },
  ),
);
