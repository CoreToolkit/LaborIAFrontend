import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "@/utils/session";
import { PerfilCompleto, Experience, Skill, Preferencias } from "@/types/profile";

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

type BackendAuthMeResponse = {
  id?: string | number;
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
  picture?: string;
  avatar?: string;
  telefono?: string;
  ubicacion?: string;
  carrera?: string;
  universidad?: string;
  fechaGraduacion?: string;
  fecha_graduacion?: string;
  bio?: string;
  descripcion?: string;
  nivelIngles?: string;
  nivel_ingles?: string;
  experiencias?: Experience[];
  habilidades?: Skill[];
  preferencias?: Preferencias;
  estadisticas?: PerfilCompleto["estadisticas"];
  logros?: PerfilCompleto["logros"];
  redesSociales?: PerfilCompleto["redesSociales"];
  cvUrl?: string;
};

type BackendProfileResponse = {
  id?: string | number;
  user_id?: string | number;
  full_name?: string;
  career?: string;
  university?: string;
  graduation_date?: string;
  description?: string;
  english_level?: string;
  preferred_location?: string;
  preferred_employment_type?: string;
  salary_expectation?: number | string | null;
};

type BackendProfilePayload = {
  full_name?: string;
  career?: string;
  university?: string;
  graduation_date?: string;
  description?: string;
  english_level?: string;
  preferred_location?: string;
  preferred_employment_type?: string;
  salary_expectation?: number;
};

type BackendExperienceResponse = {
  id: number;
  profile_id: number;
  position: string;
  company: string;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
  currently_working: boolean;
};

type BackendExperiencePayload = {
  position: string;
  company: string;
  start_date: string;
  end_date?: string | null;
  description?: string;
  currently_working: boolean;
};

type BackendSkillResponse = {
  id: number;
  profile_id: number;
  name: string;
  category?: string | null;
  level?: string | null;
};

type BackendSkillPayload = {
  name: string;
  category?: string;
  level?: string;
};

const ENGLISH_LEVEL_TO_BACKEND: Record<string, string> = {
  Basico: "Basic",
  "Básico": "Basic",
  Intermedio: "Intermediate",
  Avanzado: "Advanced",
  Fluido: "Advanced",
  Nativo: "Native",
  Basic: "Basic",
  Intermediate: "Intermediate",
  Advanced: "Advanced",
  Native: "Native",
};

const ENGLISH_LEVEL_TO_FRONTEND: Record<string, string> = {
  Basic: "Basico",
  Intermediate: "Intermedio",
  Advanced: "Avanzado",
  Fluent: "Fluido",
  Native: "Nativo",
};

const EMPLOYMENT_TYPE_TO_BACKEND: Record<string, string> = {
  "Tiempo completo": "Full-time",
  "Medio tiempo": "Part-time",
  Freelance: "Freelance",
  Contrato: "Contract",
  "Por proyecto": "Contract",
  Pasantia: "Internship",
  "Pasantía": "Internship",
  Internship: "Internship",
  "Full-time": "Full-time",
  "Part-time": "Part-time",
  Contract: "Contract",
};

const EMPLOYMENT_TYPE_TO_FRONTEND: Record<string, string> = {
  "Full-time": "Tiempo completo",
  "Part-time": "Medio tiempo",
  Freelance: "Freelance",
  Contract: "Contrato",
  Internship: "Pasantía",
};

const SKILL_LEVEL_TO_BACKEND: Record<Skill["nivel"], string> = {
  Basico: "basic",
  Intermedio: "intermediate",
  Avanzado: "advanced",
};

const VALID_BACKEND_ENGLISH_LEVELS = new Set(["Basic", "Intermediate", "Advanced", "Native"]);
const VALID_BACKEND_EMPLOYMENT_TYPES = new Set([
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
  "Internship",
]);

const normalizeText = (value?: string | null): string | undefined => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toFrontendEnglishLevel = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  return ENGLISH_LEVEL_TO_FRONTEND[value] || value;
};

const toBackendEnglishLevel = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  return ENGLISH_LEVEL_TO_BACKEND[value] || value;
};

const toFrontendEmploymentType = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  return EMPLOYMENT_TYPE_TO_FRONTEND[value] || value;
};

const toBackendEmploymentType = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  return EMPLOYMENT_TYPE_TO_BACKEND[value] || value;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toBackendSkillLevel = (value?: Skill["nivel"]): string | undefined => {
  if (!value) return undefined;

  return SKILL_LEVEL_TO_BACKEND[value] || value;
};

const toFrontendSkillLevel = (value?: string | null): Skill["nivel"] => {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return "Intermedio";

  if (normalized.includes("basic") || normalized.includes("basico") || normalized.includes("junior")) {
    return "Basico";
  }

  if (
    normalized.includes("advanced") ||
    normalized.includes("avanz") ||
    normalized.includes("senior") ||
    normalized.includes("expert")
  ) {
    return "Avanzado";
  }

  return "Intermedio";
};

const toFrontendSkillType = (value?: string | null): Skill["tipo"] => {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return "tecnica";

  if (normalized.includes("soft") || normalized.includes("blanda")) {
    return "blanda";
  }

  return "tecnica";
};

const mapBackendExperienceToFrontend = (backendExperience: BackendExperienceResponse): Experience => ({
  id: String(backendExperience.id),
  cargo: backendExperience.position,
  empresa: backendExperience.company,
  fechaInicio: backendExperience.start_date,
  fechaFin: backendExperience.end_date ?? null,
  descripcion: normalizeText(backendExperience.description),
  esActual: backendExperience.currently_working,
  ubicacion: undefined,
});

const mapFrontendExperienceToBackend = (experience: Experience): BackendExperiencePayload => ({
  position: experience.cargo,
  company: experience.empresa,
  start_date: experience.fechaInicio,
  end_date: experience.esActual ? null : normalizeText(experience.fechaFin) ?? null,
  description: normalizeText(experience.descripcion),
  currently_working: experience.esActual,
});

const mapBackendSkillToFrontend = (backendSkill: BackendSkillResponse): Skill => ({
  id: String(backendSkill.id),
  nombre: backendSkill.name,
  tipo: toFrontendSkillType(backendSkill.category),
  nivel: toFrontendSkillLevel(backendSkill.level),
  descripcion: undefined,
});

const mapFrontendSkillToBackend = (skill: Skill): BackendSkillPayload => ({
  name: skill.nombre,
  category: skill.tipo,
  level: toBackendSkillLevel(skill.nivel),
});

const toResourceIdOrThrow = (id: string, resourceName: string): number => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`ID de ${resourceName} inválido.`);
  }

  return parsed;
};

const extractApiError = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

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

      if (messages.length > 0) {
        return messages.join(", ");
      }
    }

    if (typeof data?.message === "string") {
      return data.message;
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const UNAUTHENTICATED_ERROR = "__UNAUTHENTICATED__";

const createEmptyProfile = (): PerfilCompleto => ({
  id: "",
  email: "",
  nombre: "",
  experiencias: [],
  habilidades: [],
  logros: [],
});

const mergeProfile = (base: PerfilCompleto, updates: Partial<PerfilCompleto>): PerfilCompleto => ({
  ...base,
  ...updates,
  experiencias: updates.experiencias ?? base.experiencias,
  habilidades: updates.habilidades ?? base.habilidades,
  logros: updates.logros ?? base.logros,
  preferencias: updates.preferencias
    ? {
        ...base.preferencias,
        ...updates.preferencias,
      }
    : base.preferencias,
});

const buildBackendPayload = (profile: PerfilCompleto): BackendProfilePayload => {
  const preferredLocation =
    normalizeText(profile.preferencias?.ubicacion) || normalizeText(profile.ubicacion);
  const salaryExpectation = toNumber(profile.preferencias?.salarioEsperado);
  const englishLevelCandidate = toBackendEnglishLevel(profile.nivelIngles);
  const employmentTypeCandidate = toBackendEmploymentType(profile.preferencias?.tipoContrato);
  const englishLevel =
    englishLevelCandidate && VALID_BACKEND_ENGLISH_LEVELS.has(englishLevelCandidate)
      ? englishLevelCandidate
      : undefined;
  const preferredEmploymentType =
    employmentTypeCandidate && VALID_BACKEND_EMPLOYMENT_TYPES.has(employmentTypeCandidate)
      ? employmentTypeCandidate
      : undefined;

  return {
    full_name: normalizeText(profile.nombre),
    career: normalizeText(profile.carrera),
    university: normalizeText(profile.universidad),
    graduation_date: normalizeText(profile.fechaGraduacion),
    description: normalizeText(profile.bio),
    english_level: englishLevel,
    preferred_location: preferredLocation,
    preferred_employment_type: preferredEmploymentType,
    salary_expectation: salaryExpectation,
  };
};

const buildSafeCreatePayload = (payload: BackendProfilePayload): BackendProfilePayload => {
  return {
    full_name: payload.full_name,
    career: payload.career,
    university: payload.university,
    graduation_date: payload.graduation_date,
    description: payload.description,
    preferred_location: payload.preferred_location,
  };
};

const mapBackendProfileIntoFrontend = (
  currentProfile: PerfilCompleto,
  backendProfile: BackendProfileResponse
): PerfilCompleto => {
  const preferredLocation = normalizeText(backendProfile.preferred_location);
  const preferredEmploymentType = toFrontendEmploymentType(
    normalizeText(backendProfile.preferred_employment_type)
  );
  const salaryExpectation = toNumber(backendProfile.salary_expectation);

  const hasBackendPreferences = Boolean(
    preferredLocation || preferredEmploymentType || salaryExpectation !== undefined
  );

  return {
    ...currentProfile,
    id:
      String(backendProfile.user_id ?? "") ||
      String(backendProfile.id ?? "") ||
      currentProfile.id,
    nombre: normalizeText(backendProfile.full_name) || currentProfile.nombre,
    carrera: normalizeText(backendProfile.career),
    universidad: normalizeText(backendProfile.university),
    fechaGraduacion: normalizeText(backendProfile.graduation_date),
    bio: normalizeText(backendProfile.description),
    nivelIngles: toFrontendEnglishLevel(normalizeText(backendProfile.english_level)),
    ubicacion: preferredLocation || currentProfile.ubicacion,
    preferencias: hasBackendPreferences
      ? {
          ...currentProfile.preferencias,
          ubicacion: preferredLocation,
          tipoContrato: preferredEmploymentType,
          salarioEsperado: salaryExpectation,
        }
      : currentProfile.preferencias,
  };
};

const buildProfileFromBackend = (
  authData: BackendAuthMeResponse,
  backendProfile: BackendProfileResponse | null,
  backendExperiences: BackendExperienceResponse[] | null,
  backendSkills: BackendSkillResponse[] | null
): PerfilCompleto => {
  const preferredLocation =
    normalizeText(backendProfile?.preferred_location) || normalizeText(authData.ubicacion);
  const preferredEmploymentType = toFrontendEmploymentType(
    normalizeText(backendProfile?.preferred_employment_type)
  );
  const salaryExpectation = toNumber(backendProfile?.salary_expectation);
  const authPreferencias = authData.preferencias;
  const hasPreferences = Boolean(
    preferredLocation ||
      preferredEmploymentType ||
      salaryExpectation !== undefined ||
      authPreferencias?.cargo ||
      authPreferencias?.industria ||
      authPreferencias?.disponibilidadInmediata
  );

  return {
    id:
      String(authData.id ?? "") ||
      String(authData.sub ?? "") ||
      String(backendProfile?.user_id ?? "") ||
      String(backendProfile?.id ?? ""),
    email: authData.email || "",
    nombre:
      normalizeText(backendProfile?.full_name) ||
      normalizeText(authData.name) ||
      normalizeText(authData.given_name) ||
      "",
    fotoPerfil: authData.picture || authData.avatar || undefined,
    telefono: normalizeText(authData.telefono),
    ubicacion: preferredLocation,
    carrera: normalizeText(backendProfile?.career) || normalizeText(authData.carrera),
    universidad: normalizeText(backendProfile?.university) || normalizeText(authData.universidad),
    fechaGraduacion:
      normalizeText(backendProfile?.graduation_date) ||
      normalizeText(authData.fechaGraduacion) ||
      normalizeText(authData.fecha_graduacion),
    bio: normalizeText(backendProfile?.description) || normalizeText(authData.bio) || normalizeText(authData.descripcion),
    nivelIngles:
      toFrontendEnglishLevel(normalizeText(backendProfile?.english_level)) ||
      toFrontendEnglishLevel(normalizeText(authData.nivelIngles)) ||
      toFrontendEnglishLevel(normalizeText(authData.nivel_ingles)),
    experiencias:
      backendExperiences?.map(mapBackendExperienceToFrontend) ||
      authData.experiencias ||
      [],
    habilidades:
      backendSkills?.map(mapBackendSkillToFrontend) ||
      authData.habilidades ||
      [],
    preferencias: hasPreferences
      ? {
          cargo: authPreferencias?.cargo,
          industria: authPreferencias?.industria,
          ubicacion: preferredLocation,
          salarioEsperado: salaryExpectation ?? authPreferencias?.salarioEsperado,
          tipoContrato: preferredEmploymentType || authPreferencias?.tipoContrato,
          disponibilidadInmediata: authPreferencias?.disponibilidadInmediata,
        }
      : undefined,
    estadisticas: authData.estadisticas,
    logros: authData.logros || [],
    redesSociales: authData.redesSociales,
    cvUrl: authData.cvUrl,
  };
};

export function useProfile(): UseProfileResult {
  const router = useRouter();
  const [profile, setProfile] = useState<PerfilCompleto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

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
          headers: {
            "Content-Type": "application/json",
          },
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
      {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      },
      "No se pudo conectar con el servicio de perfil para guardar datos."
    );

    let extractedError: string | null = null;

    if (response.status === 404) {
      const createResponse = await fetchFromProfileApi(
        "",
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        },
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
            {
              method: "PUT",
              headers,
              body: JSON.stringify(payload),
            },
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
              {
                method: "POST",
                headers,
                body: JSON.stringify(safeCreatePayload),
              },
              "No se pudo conectar con el servicio de perfil para crear un perfil base."
            );

            if (safeCreateResponse.ok) {
              const safeCreatedProfile = (await safeCreateResponse.json()) as BackendProfileResponse;
              const bestEffortUpdateResponse = await fetchFromProfileApi(
                "/me",
                {
                  method: "PUT",
                  headers,
                  body: JSON.stringify(payload),
                },
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
            {
              method: "GET",
              headers,
            },
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
      if (response.status === 401) {
        throw new Error(UNAUTHENTICATED_ERROR);
      }

      const backendError = extractedError || (await extractApiError(response, "No se pudo guardar el perfil."));

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
        {
          method: "GET",
          headers,
        },
        "No se pudo conectar con el servicio de autenticación."
      );

      if (!authResponse.ok) {
        if (authResponse.status === 401) {
          handleUnauthenticated();
          return;
        }

        throw new Error(await extractApiError(authResponse, `Error al cargar auth/me: ${authResponse.status}`));
      }

      const authData = (await authResponse.json()) as BackendAuthMeResponse;

      let backendProfile: BackendProfileResponse | null = null;
      let backendExperiences: BackendExperienceResponse[] | null = null;
      let backendSkills: BackendSkillResponse[] | null = null;
      const profileResponse = await fetchFromProfileApi(
        "/me",
        {
          method: "GET",
          headers,
        },
        "No se pudo conectar con el servicio de perfil."
      );

      if (profileResponse.ok) {
        backendProfile = (await profileResponse.json()) as BackendProfileResponse;

        const experiencesResponse = await fetchFromProfileApi(
          "/experiences",
          {
            method: "GET",
            headers,
          },
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
          {
            method: "GET",
            headers,
          },
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

      setProfile(buildProfileFromBackend(authData, backendProfile, backendExperiences, backendSkills));
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
    if (!token) {
      handleUnauthenticated();
      return;
    }

    try {
      const response = await fetchFromProfileApi(
        "/experiences",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mapFrontendExperienceToBackend(experience)),
        },
        "No se pudo conectar con el servicio para agregar experiencia."
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        throw new Error(await extractApiError(response, "No se pudo agregar la experiencia."));
      }

      const createdExperience = (await response.json()) as BackendExperienceResponse;
      const mappedExperience = mapBackendExperienceToFrontend(createdExperience);

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          experiencias: [...prev.experiencias, mappedExperience],
        };
      });
    } catch (err) {
      console.error("Error agregando experiencia:", err);
      throw err;
    }
  };

  const updateExperience = async (id: string, experience: Experience) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) {
      handleUnauthenticated();
      return;
    }

    try {
      const experienceId = toResourceIdOrThrow(id, "experiencia");

      const response = await fetchFromProfileApi(
        `/experiences/${experienceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mapFrontendExperienceToBackend(experience)),
        },
        "No se pudo conectar con el servicio para actualizar experiencia."
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        throw new Error(await extractApiError(response, "No se pudo actualizar la experiencia."));
      }

      const updatedExperience = mapBackendExperienceToFrontend(
        (await response.json()) as BackendExperienceResponse
      );

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          experiencias: prev.experiencias.map((exp) =>
            exp.id === String(experienceId) ? updatedExperience : exp
          ),
        };
      });
    } catch (err) {
      console.error("Error actualizando experiencia:", err);
      throw err;
    }
  };

  const deleteExperience = async (id: string) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) {
      handleUnauthenticated();
      return;
    }

    try {
      const experienceId = toResourceIdOrThrow(id, "experiencia");

      const response = await fetchFromProfileApi(
        `/experiences/${experienceId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        "No se pudo conectar con el servicio para eliminar experiencia."
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        throw new Error(await extractApiError(response, "No se pudo eliminar la experiencia."));
      }

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          experiencias: prev.experiencias.filter((exp) => exp.id !== String(experienceId)),
        };
      });
    } catch (err) {
      console.error("Error eliminando experiencia:", err);
      throw err;
    }
  };

  const addSkill = async (skill: Skill) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) {
      handleUnauthenticated();
      return;
    }

    try {
      const response = await fetchFromProfileApi(
        "/skills",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mapFrontendSkillToBackend(skill)),
        },
        "No se pudo conectar con el servicio para agregar habilidad."
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        throw new Error(await extractApiError(response, "No se pudo agregar la habilidad."));
      }

      const createdSkill = mapBackendSkillToFrontend((await response.json()) as BackendSkillResponse);

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          habilidades: [...prev.habilidades, createdSkill],
        };
      });
    } catch (err) {
      console.error("Error agregando skill:", err);
      throw err;
    }
  };

  const updateSkill = async (id: string, skill: Skill) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) {
      handleUnauthenticated();
      return;
    }

    try {
      const skillId = toResourceIdOrThrow(id, "habilidad");

      const response = await fetchFromProfileApi(
        `/skills/${skillId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mapFrontendSkillToBackend(skill)),
        },
        "No se pudo conectar con el servicio para actualizar habilidad."
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        throw new Error(await extractApiError(response, "No se pudo actualizar la habilidad."));
      }

      const updatedSkill = mapBackendSkillToFrontend((await response.json()) as BackendSkillResponse);

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          habilidades: prev.habilidades.map((item) =>
            item.id === String(skillId) ? updatedSkill : item
          ),
        };
      });
    } catch (err) {
      console.error("Error actualizando skill:", err);
      throw err;
    }
  };

  const deleteSkill = async (id: string) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) {
      handleUnauthenticated();
      return;
    }

    try {
      const skillId = toResourceIdOrThrow(id, "habilidad");

      const response = await fetchFromProfileApi(
        `/skills/${skillId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        "No se pudo conectar con el servicio para eliminar habilidad."
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthenticated();
          return;
        }

        throw new Error(await extractApiError(response, "No se pudo eliminar la habilidad."));
      }

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          habilidades: prev.habilidades.filter((item) => item.id !== String(skillId)),
        };
      });
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
