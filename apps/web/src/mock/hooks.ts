"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@tobacco/ui";
import type { MockDb } from "@tobacco/shared";
import type { Ctx } from "./ctx";
import { runAction, runQuery } from "./api";
import { getDb, getServerDb, subscribe } from "./store";

/**
 * Synchronous, instantly-reactive read of the mock DB (no latency, no loading state).
 * Use for small always-visible bits (nav badges, counts, permission checks).
 * Use `useDbQuery` for page data so users see realistic loading states.
 */
export function useDb<T>(selector: (db: MockDb) => T): T {
  const db = useSyncExternalStore(subscribe, getDb, getServerDb);
  return useMemo(() => selector(db), [db, selector]);
}

/**
 * Page-level read through TanStack Query (artificial latency → skeletons).
 * Include every selector input in `key`. All "db" queries are invalidated on every committed write.
 */
export function useDbQuery<T>(
  key: readonly unknown[],
  selector: (db: MockDb) => T,
  options: { enabled?: boolean; latency?: number } = {},
) {
  return useQuery({
    queryKey: ["db", ...key],
    queryFn: () => runQuery(selector, { latency: options.latency }),
    enabled: options.enabled,
    placeholderData: keepPreviousData,
  });
}

export type ActionResult<O> = { ok: true; data: O } | { ok: false; error: Error };

export interface ActionOptions<I, O> {
  /** Success toast text (or a function of the result). */
  success?: string | ((out: O, input: I) => string);
  onSuccess?: (out: O, input: I) => void;
  onError?: (error: Error) => void;
  /** Suppress the error toast (the caller shows the error inline). */
  silent?: boolean;
  /** Override artificial latency in ms (use a small value for scans). */
  latency?: number;
}

/**
 * Run a mock write operation. `run(input)` never rejects: it resolves to `{ok, data|error}` and shows
 * toasts for success/failure unless suppressed. Errors carry the verbatim e-Port message text.
 */
export function useAction<I, O>(fn: (ctx: Ctx, input: I) => O, options: ActionOptions<I, O> = {}) {
  const optsRef = useRef(options);
  optsRef.current = options;
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const mutation = useMutation<O, Error, I>({
    mutationFn: (input) =>
      runAction((ctx) => fnRef.current(ctx, input), { latency: optsRef.current.latency }),
  });
  const { mutateAsync } = mutation;

  const run = useCallback(
    async (input: I): Promise<ActionResult<O>> => {
      try {
        const data = await mutateAsync(input);
        const { success, onSuccess } = optsRef.current;
        if (success) toast.success(typeof success === "function" ? success(data, input) : success);
        onSuccess?.(data, input);
        return { ok: true, data };
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        if (!optsRef.current.silent) toast.error(error.message);
        optsRef.current.onError?.(error);
        return { ok: false, error };
      }
    },
    [mutateAsync],
  );

  return { run, isPending: mutation.isPending };
}
