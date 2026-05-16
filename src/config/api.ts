/**
 * Single source of truth for all backend URL configuration.
 * Client-side code imports API_CONFIG; Next.js API routes use getServerBackendUrl.
 */

export const API_CONFIG = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? "",
  backendWsBase: process.env.NEXT_PUBLIC_BACKEND_WS_BASE ?? "",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
} as const;

/** Returns true when the backend URL is configured. */
export const isBackendConfigured = (): boolean => Boolean(API_CONFIG.backendUrl);

/**
 * Used by Next.js API routes (server-side).
 * Falls back to BACKEND_URL (without NEXT_PUBLIC_ prefix) for server-only environments.
 */
export const getServerBackendUrl = (): string =>
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";
