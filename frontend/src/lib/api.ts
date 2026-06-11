"use client";

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { TokenPair } from "./types";

const TOKEN_KEY = "nsfa.tokens";

export function loadTokens(): TokenPair | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as TokenPair) : null;
}

export function saveTokens(tokens: TokenPair | null) {
  if (typeof window === "undefined") return;
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = loadTokens();
  if (tokens) config.headers.Authorization = `Bearer ${tokens.access_token}`;
  return config;
});

let refreshing: Promise<TokenPair | null> | null = null;

async function refreshTokens(): Promise<TokenPair | null> {
  const tokens = loadTokens();
  if (!tokens) return null;
  try {
    const { data } = await axios.post<TokenPair>("/api/v1/auth/refresh", {
      refresh_token: tokens.refresh_token,
    });
    saveTokens(data);
    return data;
  } catch {
    saveTokens(null);
    return null;
  }
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
  if (error.response?.status === 401 && original && !original._retried && loadTokens()) {
    original._retried = true;
    refreshing = refreshing ?? refreshTokens();
    const fresh = await refreshing;
    refreshing = null;
    if (fresh) {
      original.headers.Authorization = `Bearer ${fresh.access_token}`;
      return api.request(original);
    }
    if (typeof window !== "undefined") window.location.href = "/auth/login";
  }
  return Promise.reject(error);
});

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
    if (error.response?.status) return `Request failed (${error.response.status})`;
  }
  return "Network error — is the API running?";
}
