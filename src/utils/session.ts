const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
export const OAUTH_PROVIDER_KEY = "oauth_provider";

export type Provider = "google" | "microsoft";

export const saveTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setProvider = (provider: Provider) =>
  sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider);

export const getProvider = () =>
  sessionStorage.getItem(OAUTH_PROVIDER_KEY) as Provider | null;

export const clearProvider = () => sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
