import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./session";
import { buildSafeCreatePayload } from "./profileMappers";
import { UNAUTHENTICATED_ERROR } from "./profileAuth";
import type { BackendProfilePayload, BackendProfileResponse } from "@/types/profileBackend";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export const fetchFromProfileApi = async (
  path: string,
  init: RequestInit,
  networkErrorMessage: string
): Promise<Response> => {
  try {
    return await fetch(`/api/profile${path}`, init);
  } catch {
    throw new Error(networkErrorMessage);
  }
};

export const extractApiError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      const messages = data.detail
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null && "msg" in item) {
            const maybeMessage = (item as { msg?: unknown }).msg;
            return typeof maybeMessage === "string" ? maybeMessage : "";
          }
          return "";
        })
        .filter(Boolean);
      if (messages.length > 0) return messages.join(", ");
    }
    if (typeof data?.message === "string") return data.message;
  } catch {
    return fallback;
  }
  return fallback;
};

// ─── Session refresh ──────────────────────────────────────────────────────────

const validateSessionAfterServerError = async (): Promise<
  "session-user-missing" | "session-ok" | "unknown"
> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return "unknown";

  try {
    const refreshResponse = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (refreshResponse.ok) {
      const refreshData = (await refreshResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (refreshData.access_token && refreshData.refresh_token) {
        saveTokens(refreshData.access_token, refreshData.refresh_token);
      }
      return "session-ok";
    }

    const refreshErrorMessage = await extractApiError(refreshResponse, "");
    if (
      refreshResponse.status === 401 &&
      refreshErrorMessage.toLowerCase().includes("user not found")
    ) {
      return "session-user-missing";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
};

// ─── Profile upsert (PUT-or-POST with retry) ──────────────────────────────────

export const upsertProfile = async (
  token: string,
  payload: BackendProfilePayload,
  allowRefreshRetry = true
): Promise<BackendProfileResponse> => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let response = await fetchFromProfileApi(
    "/me",
    { method: "PUT", headers, body: JSON.stringify(payload) },
    "No se pudo conectar con el servicio de perfil para guardar datos."
  );

  let extractedError: string | null = null;

  if (response.status === 404) {
    const createResponse = await fetchFromProfileApi(
      "",
      { method: "POST", headers, body: JSON.stringify(payload) },
      "No se pudo conectar con el servicio de perfil para crear datos."
    );

    if (!createResponse.ok) {
      extractedError = await extractApiError(createResponse, "No se pudo crear el perfil.");

      if (
        createResponse.status === 400 &&
        extractedError.toLowerCase().includes("already has a profile")
      ) {
        response = await fetchFromProfileApi(
          "/me",
          { method: "PUT", headers, body: JSON.stringify(payload) },
          "No se pudo conectar con el servicio de perfil para guardar datos."
        );
      } else if (createResponse.status >= 500) {
        const hasFragileFields = Boolean(
          payload.english_level ||
            payload.preferred_employment_type ||
            payload.salary_expectation !== undefined
        );

        if (hasFragileFields) {
          const safePayload = buildSafeCreatePayload(payload);
          const safeCreateResponse = await fetchFromProfileApi(
            "",
            { method: "POST", headers, body: JSON.stringify(safePayload) },
            "No se pudo conectar con el servicio de perfil para crear un perfil base."
          );

          if (safeCreateResponse.ok) {
            const safeCreatedProfile = (await safeCreateResponse.json()) as BackendProfileResponse;
            const bestEffortResponse = await fetchFromProfileApi(
              "/me",
              { method: "PUT", headers, body: JSON.stringify(payload) },
              "No se pudo conectar con el servicio de perfil para completar datos adicionales."
            );

            if (bestEffortResponse.ok) {
              return (await bestEffortResponse.json()) as BackendProfileResponse;
            }
            // Keep onboarding moving with the base profile if optional fields fail server-side.
            return safeCreatedProfile;
          }
        }

        const maybeCreatedProfile = await fetchFromProfileApi(
          "/me",
          { method: "GET", headers },
          "No se pudo verificar el estado del perfil después del guardado."
        );

        if (maybeCreatedProfile.ok) {
          return (await maybeCreatedProfile.json()) as BackendProfileResponse;
        }

        response = createResponse;
      } else {
        response = createResponse;
      }
    } else {
      response = createResponse;
    }
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error(UNAUTHENTICATED_ERROR);

    const backendError =
      extractedError || (await extractApiError(response, "No se pudo guardar el perfil."));

    if (response.status >= 500) {
      const sessionState = await validateSessionAfterServerError();

      if (sessionState === "session-user-missing") {
        clearTokens();
        throw new Error(
          "La sesión actual no corresponde a un usuario válido en el backend. Inicia sesión nuevamente para recrear el usuario y luego completa el onboarding."
        );
      }

      if (sessionState === "session-ok" && allowRefreshRetry) {
        const refreshedAccessToken = getAccessToken();
        if (refreshedAccessToken && refreshedAccessToken !== token) {
          return upsertProfile(refreshedAccessToken, payload, false);
        }
      }

      throw new Error(
        `${backendError}. El backend devolvió un error interno al crear el perfil. Cierra sesión e inicia sesión nuevamente para recrear la identidad del usuario.`
      );
    }

    throw new Error(backendError);
  }

  return (await response.json()) as BackendProfileResponse;
};
