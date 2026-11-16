"use client";

import { create } from "zustand";
import type { BuyerPermission, PublicPrincipalDto, SessionDto } from "@tobacco/shared";
import { createApiClient, type SessionChannel } from "./client";

/**
 * Buyer Portal session.
 *  - access token: memory only (short-lived, never persisted);
 *  - refresh token: localStorage (rotated on every use; the API detects reuse and revokes the family).
 * The API is authoritative for permissions — everything here only drives what the UI shows.
 */
const REFRESH_KEY = "tobacco.buyer.refresh";

const storage = {
  get(): string | null {
    try {
      return window.localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null): void {
    try {
      if (token) window.localStorage.setItem(REFRESH_KEY, token);
      else window.localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* storage unavailable (private window) — the session simply won't survive a reload */
    }
  },
};

interface BuyerSessionState {
  /** booting: checking for a stored refresh token; anonymous: signed out; authenticated: ready. */
  status: "booting" | "anonymous" | "authenticated";
  principal: PublicPrincipalDto | null;
  accessToken: string | null;
  /** Establish a session from a login/refresh response. */
  apply: (s: SessionDto) => void;
  /** Try to resume from the stored refresh token (called once when the portal loads). */
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<PublicPrincipalDto>;
  signOut: () => Promise<void>;
  /** Drop the session without calling the API (it is already invalid). */
  clear: () => void;
}

/** Unauthenticated client for the auth endpoints themselves. */
const anon = createApiClient(null);

let restoring: Promise<void> | null = null;

export const useBuyerSession = create<BuyerSessionState>()((set, get) => ({
  status: "booting",
  principal: null,
  accessToken: null,

  apply(s) {
    if (s.principal.type !== "BUYER") throw new Error("This portal is for buyer accounts only.");
    storage.set(s.refreshToken);
    set({ status: "authenticated", principal: s.principal, accessToken: s.accessToken });
  },

  restore() {
    restoring ??= (async () => {
      const token = storage.get();
      if (!token) {
        set({ status: "anonymous" });
        return;
      }
      try {
        const session = await anon.post<SessionDto>("/auth/refresh", { refreshToken: token }, { anonymous: true });
        get().apply(session);
      } catch {
        storage.set(null);
        set({ status: "anonymous", principal: null, accessToken: null });
      }
    })();
    return restoring;
  },

  async signIn(email, password) {
    const session = await anon.post<SessionDto>("/auth/buyer/login", { email, password }, { anonymous: true });
    get().apply(session);
    return session.principal;
  },

  async signOut() {
    const token = storage.get();
    get().clear();
    if (token) await anon.post("/auth/logout", { refreshToken: token }, { anonymous: true }).catch(() => undefined);
  },

  clear() {
    storage.set(null);
    restoring = null;
    set({ status: "anonymous", principal: null, accessToken: null });
  },
}));

const channel: SessionChannel = {
  getAccessToken: () => useBuyerSession.getState().accessToken,
  async refresh() {
    const token = storage.get();
    if (!token) return null;
    try {
      const session = await anon.post<SessionDto>("/auth/refresh", { refreshToken: token }, { anonymous: true });
      useBuyerSession.getState().apply(session);
      return session.accessToken;
    } catch {
      return null;
    }
  },
  onAuthLost: () => useBuyerSession.getState().clear(),
};

/** The authenticated API client for the Buyer Portal. */
export const buyerApi = createApiClient(channel);

/** Unauthenticated calls (forgot / reset / activate). */
export const publicApi = anon;

export function useBuyerPrincipal(): PublicPrincipalDto | null {
  return useBuyerSession((s) => s.principal);
}

/** `can("buyer.receiving.scan")` — UI gating only; the API enforces every permission itself. */
export function useBuyerCan(): (permission: BuyerPermission) => boolean {
  const permissions = useBuyerSession((s) => s.principal?.permissions);
  return (p) => Boolean(permissions?.includes(p));
}

export function useBuyerGuard(permission: BuyerPermission | undefined): { allowed: boolean; reason?: string } {
  const permissions = useBuyerSession((s) => s.principal?.permissions);
  if (!permission || permissions?.includes(permission)) return { allowed: true };
  return { allowed: false, reason: "Your role does not include this action. Ask your company's Buyer Administrator." };
}
