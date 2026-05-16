import { Dispatch, SetStateAction } from "react";
import { PerfilCompleto, Experience } from "@/types/profile";
import {
  mapBackendExperienceToFrontend,
  mapFrontendExperienceToBackend,
  toResourceIdOrThrow,
} from "@/utils/profileMappers";
import { extractApiError, fetchFromProfileApi } from "@/utils/profileApiClient";
import { UNAUTHENTICATED_ERROR, getAuthToken, makeAuthHeaders } from "@/utils/profileAuth";
import type { BackendExperienceResponse } from "@/types/profileBackend";

type SetProfile = Dispatch<SetStateAction<PerfilCompleto | null>>;

export function useExperienceManager(
  setProfile: SetProfile,
  handleUnauthenticated: () => void
) {
  const addExperience = async (experience: Experience) => {
    const token = getAuthToken(handleUnauthenticated);
    if (!token) return;

    try {
      const response = await fetchFromProfileApi(
        "/experiences",
        {
          method: "POST",
          headers: makeAuthHeaders(token),
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
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) { handleUnauthenticated(); return; }
      console.error("Error agregando experiencia:", err);
      throw err;
    }
  };

  const updateExperience = async (id: string, experience: Experience) => {
    const token = getAuthToken(handleUnauthenticated);
    if (!token) return;

    try {
      const experienceId = toResourceIdOrThrow(id, "experiencia");

      const response = await fetchFromProfileApi(
        `/experiences/${experienceId}`,
        {
          method: "PUT",
          headers: makeAuthHeaders(token),
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
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) { handleUnauthenticated(); return; }
      console.error("Error actualizando experiencia:", err);
      throw err;
    }
  };

  const deleteExperience = async (id: string) => {
    const token = getAuthToken(handleUnauthenticated);
    if (!token) return;

    try {
      const experienceId = toResourceIdOrThrow(id, "experiencia");

      const response = await fetchFromProfileApi(
        `/experiences/${experienceId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
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
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) { handleUnauthenticated(); return; }
      console.error("Error eliminando experiencia:", err);
      throw err;
    }
  };

  return { addExperience, updateExperience, deleteExperience };
}
