import type { ApiErrorBody } from "@tobacco/shared";

/** Base URL of the Buyer Portal API (NestJS). Set NEXT_PUBLIC_API_URL for deployed environments. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/+$/, "");

/** Every failure from the API (or the network) surfaces as one of these. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field-level problems from a 422 VALIDATION_FAILED response, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== "VALIDATION_FAILED" || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as Array<{ path?: string; message?: string }>) {
      if (d.path && d.message && !(d.path in out)) out[d.path] = d.message;
    }
    return out;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** What the client needs from a session store (buyer or staff). */
export interface SessionChannel {
  getAccessToken(): string | null;
  /** Rotate tokens. Resolve the new access token, or null when the session is over. */
  refresh(): Promise<string | null>;
  /** Called once when a request proves the session is gone. */
  onAuthLost(): void;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  /** Skip auth header + refresh logic (login, forgot-password …). */
  anonymous?: boolean;
}

/** Codes that mean "wrong credentials", not "your session expired" — never trigger a refresh for these. */
const NO_REFRESH = new Set(["INVALID_CREDENTIALS", "ACCOUNT_LOCKED", "ACCOUNT_INACTIVE"]);

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function toError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | undefined;
  try {
    body = (await res.json()) as Partial<ApiErrorBody>;
  } catch {
    /* non-JSON error body */
  }
  const e = body?.error;
  return new ApiError(e?.code ?? `HTTP_${res.status}`, e?.message ?? `Request failed (${res.status})`, res.status, e?.details, e?.requestId);
}

export function createApiClient(channel: SessionChannel | null) {
  let refreshing: Promise<string | null> | null = null;

  /** Single-flight: concurrent 401s share one refresh (rotating refresh tokens would otherwise trip reuse detection). */
  const refreshOnce = (): Promise<string | null> => {
    refreshing ??= channel!.refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  async function send(method: string, path: string, opts: RequestOptions, init: { body?: BodyInit; json?: boolean }, retried = false): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.json) headers["Content-Type"] = "application/json";
    const token = !opts.anonymous && channel ? channel.getAccessToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(buildUrl(path, opts.query), { method, headers, body: init.body, signal: opts.signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new ApiError("NETWORK", "Cannot reach the server. Check your connection and try again.", 0);
    }

    if (res.status === 401 && channel && !opts.anonymous && !retried) {
      const err = await toError(res.clone());
      if (!NO_REFRESH.has(err.code)) {
        const fresh = await refreshOnce();
        if (fresh) return send(method, path, opts, init, true);
        channel.onAuthLost();
        throw err;
      }
    }
    if (!res.ok) throw await toError(res);
    return res;
  }

  async function json<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const hasBody = opts.body !== undefined;
    const res = await send(method, path, opts, { body: hasBody ? JSON.stringify(opts.body) : undefined, json: hasBody });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    get: <T>(path: string, opts?: Omit<RequestOptions, "body">) => json<T>("GET", path, opts),
    post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => json<T>("POST", path, { ...opts, body }),
    put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => json<T>("PUT", path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => json<T>("PATCH", path, { ...opts, body }),
    delete: <T>(path: string, opts?: Omit<RequestOptions, "body">) => json<T>("DELETE", path, opts),

    /** multipart/form-data upload (Flow Disk, invoice PDF …). The browser sets the boundary. */
    async upload<T>(path: string, form: FormData, opts: Omit<RequestOptions, "body"> = {}): Promise<T> {
      const res = await send("POST", path, opts, { body: form });
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },

    /** Fetch a binary (PDF / Excel / stored document) and return it with the server's suggested filename. */
    async download(path: string, opts: Omit<RequestOptions, "body"> = {}): Promise<{ blob: Blob; filename: string }> {
      const res = await send("GET", path, { ...opts }, {});
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      return { blob: await res.blob(), filename: match?.[1] ? decodeURIComponent(match[1]) : "download" };
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Trigger a browser download for a blob returned by `client.download`. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
