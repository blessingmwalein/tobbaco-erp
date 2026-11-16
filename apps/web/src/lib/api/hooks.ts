"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { toast } from "@tobacco/ui";
import { buyerApi, useBuyerSession } from "./buyer-session";
import { isApiError } from "./client";

type Query = Record<string, string | number | boolean | undefined | null>;

/** All Buyer Portal queries live under the "buyer" key so a sign-out can drop them in one call. */
export const buyerKey = (...parts: unknown[]): QueryKey => ["buyer", ...parts];

/** GET a Buyer Portal resource. Waits for the session, keeps the previous page while paging/filtering. */
export function useBuyerQuery<T>(
  path: string,
  query?: Query,
  options: Partial<Pick<UseQueryOptions<T>, "enabled" | "refetchInterval" | "staleTime">> & { key?: unknown[] } = {},
) {
  const authed = useBuyerSession((s) => s.status === "authenticated");
  const { key, enabled = true, ...rest } = options;
  return useQuery<T>({
    queryKey: buyerKey(...(key ?? [path]), query ?? {}),
    queryFn: ({ signal }) => buyerApi.get<T>(path, { query, signal }),
    enabled: authed && enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    ...rest,
  });
}

export function describeError(e: unknown): string {
  if (isApiError(e)) return e.message;
  return e instanceof Error ? e.message : "Something went wrong";
}

interface MutationOptions<TRes> {
  /** Query-key prefixes (after "buyer") to refetch on success, e.g. [["invoices"], ["dashboard"]]. */
  invalidate?: unknown[][];
  success?: string | ((res: TRes) => string);
  /** Set false when the caller renders the error inline (forms with field errors). */
  toastError?: boolean;
  onSuccess?: (res: TRes) => void;
}

/** POST/PATCH/DELETE with consistent success/error toasts and cache invalidation. */
export function useBuyerMutation<TVars, TRes = unknown>(fn: (vars: TVars) => Promise<TRes>, opts: MutationOptions<TRes> = {}) {
  const qc = useQueryClient();
  return useMutation<TRes, Error, TVars>({
    mutationFn: fn,
    onSuccess: (res) => {
      for (const k of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: buyerKey(...k) });
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(res) : opts.success);
      opts.onSuccess?.(res);
    },
    onError: (e) => {
      if (opts.toastError !== false) toast.error(describeError(e));
    },
  });
}
