import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "@/utils/session";
import { PerfilCompleto, Experience, Skill, Preferencias } from "@/types/profile";
import { BACKEND_URL } from "@/config/api";
import {
  BackendAuthMeResponse,
  BackendProfileResponse,
  BackendProfilePayload,
  BackendExperienceResponse,
  BackendSkillResponse,
  UNAUTHENTICATED_ERROR,
  extractApiError,
  createEmptyProfile,
  mergeProfile,
  buildBackendPayload,
  buildSafeCreatePayload,
  mapBackendProfileIntoFrontend,
  buildProfileFromBackend,
  mapBackendExperienceToFrontend,
  mapFrontendExperienceToBackend,
  mapBackendSkillToFrontend,
  mapFrontendSkillToBackend,
  toResourceIdOrThrow,
} from "@/utils/profileMappers";

interface UseProfileResult {
  profile: PerfilCompleto | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateProfile: (data: Partial<PerfilCompleto>) => Promise<void>;
  addExperience: (experience: Experience) => Promise<void>;
  updateExperience: (id: string, experience: Experience) => Promise<void>;
  deleteExperience: (id: string) => Promise<void>;
  addSkill: (skill: Skill) => Promise<void>;
  updateSkill: (id: string, skill: Skill) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  updatePreferencias: (preferencias: Preferencias) => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const router = useRouter();
  const [profile, setProfile] = useState<PerfilCompleto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = BACKEND_URL;

  const fetchFromProfileApi = useCallback(
    async (path: string, init: RequestInit, networkErrorMessage: string): Promise<Response> => {
      try {
        return await fetch(`/api/profile${path}`, init);
      } catch {
        throw new Error(networkErrorMessage);
      }
    },
    []
  );

  const handleUnauthenticated = useCallback(() => {
    if (typeof window === "undefined") return;

    clearTokens();
    setProfile(null);
    setError(null);
    router.replace("/login");
  }, [router]);

  const upsertProfile = async (
    token: string,
    payload: BackendProfilePayload,
    allowRefreshRetry = true
  ): Promise<BackendProfileResponse> => {
    const validateSessionAfterServerError = async (): Promise<
      "session-user-missing" | "session-ok" | "unknown"
    > => {
      const refreshToken = getRefreshToken();
      if (!refreshToken || !backendUrl) return "unknown";

      try {
        const refreshResponse = await fetch(`/api/auth/refresh`, {
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
            const safeCreatePayload = buildSafeCreatePayload(payload);
            const safeCreateResponse = await fetchFromProfileApi(
              "",
              { method: "POST", headers, body: JSON.stringify(safeCreatePayload) },
              "No se pudo conectar con el servicio de perfil para crear un perfil base."
            );

            if (safeCreateResponse.ok) {
              const safeCreatedProfile = (await safeCreateResponse.json()) as BackendProfileResponse;
              const bestEffortUpdateResponse = await fetchFromProfileApi(
                "/me",
                { method: "PUT", headers, body: JSON.stringify(payload) },
                "No se pudo conectar con el servicio de perfil para completar datos adicionales."
              );

              if (bestEffortUpdateResponse.ok) {
                return (await bestEffortUpdateResponse.json()) as BackendProfileResponse;
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

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!backendUrl) {
      setError("Configuración incompleta. Falta la URL del backend.");
      setIsLoading(false);
      return;
    }

    // Solo en el cliente
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const token = getAccessToken();
      if (!token) {
        handleUnauthenticated();
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const authResponse = await fetchFromProfileApi(
        "/auth-me",
        { method: "GET", headers },
        "No se pudo conectar con el servicio de autenticación."
      );

      if (!authResponse.ok) {
        if (authResponse.status === 401) {
          handleUnauthenticated();
          return;
        }
        throw new Error(
          await extractApiError(authResponse, `Error al cargar auth/me: ${authResponse.status}`)
        );
      }

      const authData = (await authResponse.json()) as BackendAuthMeResponse;

      let backendProfile: BackendProfileResponse | null = null;
      let backendExperiences: BackendExperienceResponse[] | null = null;
      let backendSkills: BackendSkillResponse[] | null = null;

      const profileResponse = await fetchFromProfileApi(
        "/me",
        { method: "GET", headers },
        "No se pudo conectar con el servicio de perfil."
      );

      if (profileResponse.ok) {
        backendProfile = (await profileResponse.json()) as BackendProfileResponse;

        const experiencesResponse = await fetchFromProfileApi(
          "/experiences",
          { method: "GET", headers },
          "No se pudo conectar con el servicio de experiencias."
        );

        if (experiencesResponse.ok) {
          backendExperiences = (await experiencesResponse.json()) as BackendExperienceResponse[];
        } else if (experiencesResponse.status === 401) {
          handleUnauthenticated();
          return;
        } else if (experiencesResponse.status !== 404) {
          throw new Error(
            await extractApiError(
              experiencesResponse,
              `Error al cargar experiences: ${experiencesResponse.status}`
            )
          );
        }

        const skillsResponse = await fetchFromProfileApi(
          "/skills",
          { method: "GET", headers },
          "No se pudo conectar con el servicio de habilidades."
        );

        if (skillsResponse.ok) {
          backendSkills = (await skillsResponse.json()) as BackendSkillResponse[];
        } else if (skillsResponse.status === 401) {
          handleUnauthenticated();
          return;
        } else if (skillsResponse.status !== 404) {
          throw new Error(
            await extractApiError(
              skillsResponse,
              `Error al cargar skills: ${skillsResponse.status}`
            )
          );
        }
      } else if (profileResponse.status === 401) {
        handleUnauthenticated();
        return;
      } else if (profileResponse.status !== 404) {
        throw new Error(
          await extractApiError(
            profileResponse,
            `Error al cargar profiles/me: ${profileResponse.status}`
          )
        );
      }

      setProfile(
        buildProfileFromBackend(authData, backendProfile, backendExperiences, backendSkills)
      );
    } catch (err) {
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) {
        handleUnauthenticated();
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido al cargar el perfil.";
      setError(errorMessage);
      console.error("Error en useProfile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, fetchFromProfileApi, handleUnauthenticated]);

  const updateProfile = async (data: Partial<PerfilCompleto>) => {
    if (!backendUrl || typeof window === "undefined") return;

    const token = getAccessToken();
    if (!token) {
      handleUnauthenticated();
      return;
    }

    const baseProfile = profile ? profile : createEmptyProfile();
    const nextProfile = mergeProfile(baseProfile, data);
    const payload = buildBackendPayload(nextProfile);

    try {
      const backendProfile = await upsertProfile(token, payload);

      setProfile((prev) => {
        const mergedProfile = prev ? mergeProfile(prev, data) : nextProfile;
        return mapBackendProfileIntoFrontend(mergedProfile, backendProfile);
      });
    } catch (err) {
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) {
        handleUnauthenticated();
        return;
      }

      console.error("Error actualizando perfil:", err);
      throw err;
    }
  };

  const addExperience = async (experience: Experience) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) { handleUnauthenticated(); return; }

    try {
      const response = await fetchFromProfileApi(
        "/experiences",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(mapFrontendExperienceToBackend(experience)),
        },
        "No se pudo conectar con el servicio para agregar experiencia."
      );

      if (!response.ok) {
        if (response.status === 401) { handleUnauthenticated(); return; }
        throw new Error(await extractApiError(response, "No se pudo agregar la experiencia."));
      }

      const created = mapBackendExperienceToFrontend(
        (await response.json()) as BackendExperienceResponse
      );
      setProfile((prev) =>
        prev ? { ...prev, experiencias: [...prev.experiencias, created] } : null
      );
    } catch (err) {
      console.error("Error agregando experiencia:", err);
      throw err;
    }
  };

  const updateExperience = async (id: string, experience: Experience) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) { handleUnauthenticated(); return; }

    try {
      const experienceId = toResourceIdOrThrow(id, "experiencia");
      const response = await fetchFromProfileApi(
        `/experiences/${experienceId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(mapFrontendExperienceToBackend(experience)),
        },
        "No se pudo conectar con el servicio para actualizar experiencia."
      );

      if (!response.ok) {
        if (response.status === 401) { handleUnauthenticated(); return; }
        throw new Error(await extractApiError(response, "No se pudo actualizar la experiencia."));
      }

      const updated = mapBackendExperienceToFrontend(
        (await response.json()) as BackendExperienceResponse
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              experiencias: prev.experiencias.map((exp) =>
                exp.id === String(experienceId) ? updated : exp
              ),
            }
          : null
      );
    } catch (err) {
      console.error("Error actualizando experiencia:", err);
      throw err;
    }
  };

  const deleteExperience = async (id: string) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) { handleUnauthenticated(); return; }

    try {
      const experienceId = toResourceIdOrThrow(id, "experiencia");
      const response = await fetchFromProfileApi(
        `/experiences/${experienceId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        "No se pudo conectar con el servicio para eliminar experiencia."
      );

      if (!response.ok) {
        if (response.status === 401) { handleUnauthenticated(); return; }
        throw new Error(await extractApiError(response, "No se pudo eliminar la experiencia."));
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              experiencias: prev.experiencias.filter((exp) => exp.id !== String(experienceId)),
            }
          : null
      );
    } catch (err) {
      console.error("Error eliminando experiencia:", err);
      throw err;
    }
  };

  const addSkill = async (skill: Skill) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) { handleUnauthenticated(); return; }

    try {
      const response = await fetchFromProfileApi(
        "/skills",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(mapFrontendSkillToBackend(skill)),
        },
        "No se pudo conectar con el servicio para agregar habilidad."
      );

      if (!response.ok) {
        if (response.status === 401) { handleUnauthenticated(); return; }
        throw new Error(await extractApiError(response, "No se pudo agregar la habilidad."));
      }

      const created = mapBackendSkillToFrontend((await response.json()) as BackendSkillResponse);
      setProfile((prev) =>
        prev ? { ...prev, habilidades: [...prev.habilidades, created] } : null
      );
    } catch (err) {
      console.error("Error agregando skill:", err);
      throw err;
    }
  };

  const updateSkill = async (id: string, skill: Skill) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) { handleUnauthenticated(); return; }

    try {
      const skillId = toResourceIdOrThrow(id, "habilidad");
      const response = await fetchFromProfileApi(
        `/skills/${skillId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(mapFrontendSkillToBackend(skill)),
        },
        "No se pudo conectar con el servicio para actualizar habilidad."
      );

      if (!response.ok) {
        if (response.status === 401) { handleUnauthenticated(); return; }
        throw new Error(await extractApiError(response, "No se pudo actualizar la habilidad."));
      }

      const updated = mapBackendSkillToFrontend((await response.json()) as BackendSkillResponse);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              habilidades: prev.habilidades.map((item) =>
                item.id === String(skillId) ? updated : item
              ),
            }
          : null
      );
    } catch (err) {
      console.error("Error actualizando skill:", err);
      throw err;
    }
  };

  const deleteSkill = async (id: string) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) { handleUnauthenticated(); return; }

    try {
      const skillId = toResourceIdOrThrow(id, "habilidad");
      const response = await fetchFromProfileApi(
        `/skills/${skillId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        "No se pudo conectar con el servicio para eliminar habilidad."
      );

      if (!response.ok) {
        if (response.status === 401) { handleUnauthenticated(); return; }
        throw new Error(await extractApiError(response, "No se pudo eliminar la habilidad."));
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              habilidades: prev.habilidades.filter((item) => item.id !== String(skillId)),
            }
          : null
      );
    } catch (err) {
      console.error("Error eliminando skill:", err);
      throw err;
    }
  };

  const updatePreferencias = async (preferencias: Preferencias) => {
    await updateProfile({
      preferencias,
      ubicacion: preferencias.ubicacion ?? profile?.ubicacion,
    });
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
    updateProfile,
    addExperience,
    updateExperience,
    deleteExperience,
    addSkill,
    updateSkill,
    deleteSkill,
    updatePreferencias,
  };
}
