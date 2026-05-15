import { BACKEND_URL } from "@/config/api";

export const logoutUser = async (token: string): Promise<void> => {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const exchangeOAuthCode = async (
  provider: string,
  code: string,
  state?: string,
): Promise<{ access_token: string; refresh_token: string }> => {
  if (!BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL no está definida.");
  }

  const response = await fetch(`${BACKEND_URL}/auth/${provider}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error("La respuesta no contiene tokens.");
  }

  return data as { access_token: string; refresh_token: string };
};
