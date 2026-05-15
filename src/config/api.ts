export const getBackendUrl = (): string =>
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
