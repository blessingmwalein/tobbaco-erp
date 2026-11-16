"use client";

import { create } from "zustand";
import type { PublicPrincipalDto, SessionDto } from "@tobacco/shared";
import { createApiClient, type SessionChannel } from "./client";

/**
 * ERP staff connection to the Buyer Portal API — used only by the internal "Buyer accounts" admin screens.
 * The rest of the internal ERP still runs on its mock data; this is the single bridge to the real API.
 * Same token handling as the buyer session: access token in memory, rotating refresh token in localStorage.
 */
const REFRESH_KEY = "tobacco.staff.refresh";

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
      /* storage unavailable */
    }
  },
};

interface StaffSessionState {
  status: "booting" | "anonymous" | "authenticated";
  principal: PublicPrincipalDto | null;
  accessToken: string | null;
  apply: (s: SessionDto) => void;
  restore: () => Promise<void>;
  connect: (email: string, password: string) => Promise<PublicPrincipalDto>;
  disconnect: () => Promise<void>;
  clear: () => void;
}

const anon = createApiClient(null);
let restoring: Promise<void> | null = null;

export const useStaffSession = create<StaffSessionState>()((set, get) => ({
  status: "booting",
  principal: null,
  accessToken: null,

  apply(s) {
    if (s.principal.type !== "STAFF") throw new Error("Use an ERP staff account to manage buyer companies.");
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
        get().apply(await anon.post<SessionDto>("/auth/refresh", { refreshToken: token }, { anonymous: true }));
      } catch {
        storage.set(null);
        set({ status: "anonymous", principal: null, accessToken: null });
      }
    })();
    return restoring;
  },

  async connect(email, password) {
    const session = await anon.post<SessionDto>("/auth/staff/login", { email, password }, { anonymous: true });
    get().apply(session);
    return session.principal;
  },

  async disconnect() {
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
  getAccessToken: () => useStaffSession.getState().accessToken,
  async refresh() {
    const token = storage.get();
    if (!token) return null;
    try {
      const session = await anon.post<SessionDto>("/auth/refresh", { refreshToken: token }, { anonymous: true });
      useStaffSession.getState().apply(session);
      return session.accessToken;
    } catch {
      return null;
    }
  },
  onAuthLost: () => useStaffSession.getState().clear(),
};

/** Authenticated API client for ERP staff screens. */
export const staffApi = createApiClient(channel);
