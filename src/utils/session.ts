const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
export const OAUTH_PROVIDER_KEY = "oauth_provider";
export const SESSION_CHANGED_EVENT = "laboria:session-changed";

export type Provider = "google" | "microsoft";

const canUseBrowserStorage = () => typeof window !== "undefined";

const emitSessionChanged = () => {
  if (!canUseBrowserStorage()) return;

  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

export const saveTokens = (accessToken: string, refreshToken: string) => {
  if (!canUseBrowserStorage()) return;

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  emitSessionChanged();
};

export const clearTokens = () => {
  if (!canUseBrowserStorage()) return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  emitSessionChanged();
};

export const getAccessToken = () => {
  if (!canUseBrowserStorage()) return null;

  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = () => {
  if (!canUseBrowserStorage()) return null;

  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setProvider = (provider: Provider) =>
  canUseBrowserStorage() ? sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider) : undefined;

export const getProvider = () =>
  canUseBrowserStorage()
    ? (sessionStorage.getItem(OAUTH_PROVIDER_KEY) as Provider | null)
    : null;

export const clearProvider = () => {
  if (!canUseBrowserStorage()) return;

  sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
};
