"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "@tobacco/ui";
import { describeError } from "./hooks";
import { staffApi, useStaffSession } from "./staff-session";

type Query = Record<string, string | number | boolean | undefined | null>;

export const staffKey = (...parts: unknown[]): QueryKey => ["staff", ...parts];

/** GET through the staff connection. Waits until connected. */
export function useStaffQuery<T>(path: string, query?: Query, options: { enabled?: boolean; key?: unknown[] } = {}) {
  const authed = useStaffSession((s) => s.status === "authenticated");
  return useQuery<T>({
    queryKey: staffKey(...(options.key ?? [path]), query ?? {}),
    queryFn: ({ signal }) => staffApi.get<T>(path, { query, signal }),
    enabled: authed && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useStaffMutation<TVars, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { invalidate?: unknown[][]; success?: string | ((res: TRes) => string); toastError?: boolean; onSuccess?: (res: TRes) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation<TRes, Error, TVars>({
    mutationFn: fn,
    onSuccess: (res) => {
      for (const k of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: staffKey(...k) });
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(res) : opts.success);
      opts.onSuccess?.(res);
    },
    onError: (e) => {
      if (opts.toastError !== false) toast.error(describeError(e));
    },
  });
}
