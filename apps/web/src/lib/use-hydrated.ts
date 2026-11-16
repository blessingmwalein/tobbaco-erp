"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** false during server render and the hydration pass, true once the client has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
