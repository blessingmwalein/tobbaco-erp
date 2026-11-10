"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Demo session: "logging in" picks one of the seeded demo users. No real authentication in Phase 1. */
interface SessionState {
  userId: string | null;
  signIn: (userId: string) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      signIn: (userId) => set({ userId }),
      signOut: () => set({ userId: null }),
    }),
    {
      name: "tobacco-erp-session",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
