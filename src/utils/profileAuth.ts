import { getAccessToken } from "./session";

export const UNAUTHENTICATED_ERROR = "__UNAUTHENTICATED__";

export const makeAuthHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

export const getAuthToken = (onUnauthenticated: () => void): string | null => {
  if (typeof window === "undefined") return null;
  const token = getAccessToken();
  if (!token) {
    onUnauthenticated();
    return null;
  }
  return token;
};
