"use client";

import { create } from "zustand";
import { api, loadTokens, saveTokens } from "@/lib/api";
import type { TokenPair, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (org: string, name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  async hydrate() {
    if (!loadTokens()) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const { data } = await api.get<User>("/auth/me");
      set({ user: data, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  async login(email, password) {
    const { data } = await api.post<TokenPair>("/auth/login", { email, password });
    saveTokens(data);
    const me = await api.get<User>("/auth/me");
    set({ user: me.data, loading: false });
  },

  async register(organisation_name, full_name, email, password) {
    const { data } = await api.post<TokenPair>("/auth/register", {
      organisation_name, full_name, email, password,
    });
    saveTokens(data);
    const me = await api.get<User>("/auth/me");
    set({ user: me.data, loading: false });
  },

  async logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // token already invalid — still clear local state
    }
    saveTokens(null);
    set({ user: null });
  },
}));
