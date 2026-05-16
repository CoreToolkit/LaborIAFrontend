import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PerfilCompleto, Preferencias } from "@/types/profile";
import {
  buildBackendPayload,
  buildProfileFromBackend,
  createEmptyProfile,
  mapBackendProfileIntoFrontend,
  mergeProfile,
  type BackendAuthMeResponse,
  type BackendExperienceResponse,
  type BackendProfileResponse,
  type BackendSkillResponse,
} from "@/utils/profileMappers";
import { extractApiError, fetchFromProfileApi, upsertProfile } from "@/utils/profileApiClient";
import { UNAUTHENTICATED_ERROR } from "@/utils/profileAuth";
import { clearTokens, getAccessToken } from "@/utils/session";
import { isBackendConfigured } from "@/config/api";

export function useProfileFetch() {
  const router = useRouter();
  const [profile, setProfile] = useState<PerfilCompleto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleUnauthenticated = useCallback(() => {
    if (typeof window === "undefined") return;
    clearTokens();
    setProfile(null);
    setError(null);
    router.replace("/login");
  }, [router]);

  // ─── Fetch all profile data ──────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!isBackendConfigured()) {
      setError("Configuración incompleta. Falta la URL del backend.");
      setIsLoading(false);
      return;
    }

    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    try {
      const token = getAccessToken();
      if (!token) { handleUnauthenticated(); return; }

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
        if (authResponse.status === 401) { handleUnauthenticated(); return; }
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
          handleUnauthenticated(); return;
        } else if (experiencesResponse.status !== 404) {
          throw new Error(
            await extractApiError(experiencesResponse, `Error al cargar experiences: ${experiencesResponse.status}`)
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
          handleUnauthenticated(); return;
        } else if (skillsResponse.status !== 404) {
          throw new Error(
            await extractApiError(skillsResponse, `Error al cargar skills: ${skillsResponse.status}`)
          );
        }
      } else if (profileResponse.status === 401) {
        handleUnauthenticated(); return;
      } else if (profileResponse.status !== 404) {
        throw new Error(
          await extractApiError(profileResponse, `Error al cargar profiles/me: ${profileResponse.status}`)
        );
      }

      setProfile(buildProfileFromBackend(authData, backendProfile, backendExperiences, backendSkills));
    } catch (err) {
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) {
        handleUnauthenticated(); return;
      }
      const errorMessage = err instanceof Error ? err.message : "Error desconocido al cargar el perfil.";
      setError(errorMessage);
      console.error("Error en useProfileFetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthenticated]);

  // ─── Update profile ──────────────────────────────────────────────────────────

  const updateProfile = async (data: Partial<PerfilCompleto>) => {
    if (!isBackendConfigured() || typeof window === "undefined") return;

    const token = getAccessToken();
    if (!token) { handleUnauthenticated(); return; }

    const baseProfile = profile ?? createEmptyProfile();
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
        handleUnauthenticated(); return;
      }
      console.error("Error actualizando perfil:", err);
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
    updatePreferencias,
    setProfile,
    handleUnauthenticated,
  };
}
