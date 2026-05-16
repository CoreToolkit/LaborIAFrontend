import { Dispatch, SetStateAction } from "react";
import { PerfilCompleto, Skill } from "@/types/profile";
import {
  mapBackendSkillToFrontend,
  mapFrontendSkillToBackend,
  toResourceIdOrThrow,
} from "@/utils/profileMappers";
import { extractApiError, fetchFromProfileApi } from "@/utils/profileApiClient";
import { UNAUTHENTICATED_ERROR, getAuthToken, makeAuthHeaders } from "@/utils/profileAuth";
import type { BackendSkillResponse } from "@/types/profileBackend";

type SetProfile = Dispatch<SetStateAction<PerfilCompleto | null>>;

export function useSkillManager(
  setProfile: SetProfile,
  handleUnauthenticated: () => void
) {
  const addSkill = async (skill: Skill) => {
    const token = getAuthToken(handleUnauthenticated);
    if (!token) return;

    try {
      const response = await fetchFromProfileApi(
        "/skills",
        {
          method: "POST",
          headers: makeAuthHeaders(token),
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
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) { handleUnauthenticated(); return; }
      console.error("Error agregando skill:", err);
      throw err;
    }
  };

  const updateSkill = async (id: string, skill: Skill) => {
    const token = getAuthToken(handleUnauthenticated);
    if (!token) return;

    try {
      const skillId = toResourceIdOrThrow(id, "habilidad");

      const response = await fetchFromProfileApi(
        `/skills/${skillId}`,
        {
          method: "PUT",
          headers: makeAuthHeaders(token),
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
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) { handleUnauthenticated(); return; }
      console.error("Error actualizando skill:", err);
      throw err;
    }
  };

  const deleteSkill = async (id: string) => {
    const token = getAuthToken(handleUnauthenticated);
    if (!token) return;

    try {
      const skillId = toResourceIdOrThrow(id, "habilidad");

      const response = await fetchFromProfileApi(
        `/skills/${skillId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
        "No se pudo conectar con el servicio para eliminar habilidad."
      );

      if (!response.ok) {
        if (response.status === 401) { handleUnauthenticated(); return; }
        throw new Error(await extractApiError(response, "No se pudo eliminar la habilidad."));
      }

      setProfile((prev) =>
        prev
          ? { ...prev, habilidades: prev.habilidades.filter((item) => item.id !== String(skillId)) }
          : null
      );
    } catch (err) {
      if (err instanceof Error && err.message === UNAUTHENTICATED_ERROR) { handleUnauthenticated(); return; }
      console.error("Error eliminando skill:", err);
      throw err;
    }
  };

  return { addSkill, updateSkill, deleteSkill };
}
