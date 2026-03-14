import { useCallback, useEffect, useState } from "react";
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
  backendProfile: BackendProfileResponse | null
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
    experiencias: authData.experiencias || [],
    habilidades: authData.habilidades || [],
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

const getTokenOrThrow = (): string => {
  const token = getAccessToken();
  if (!token) {
    throw new Error("No se encontró el token de autenticación.");
  }

  return token;
};

export function useProfile(): UseProfileResult {
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
      const token = getTokenOrThrow();
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
          throw new Error("Sesión expirada. Por favor, inicia sesión nuevamente.");
        }

        throw new Error(await extractApiError(authResponse, `Error al cargar auth/me: ${authResponse.status}`));
      }

      const authData = (await authResponse.json()) as BackendAuthMeResponse;

      let backendProfile: BackendProfileResponse | null = null;
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
      } else if (profileResponse.status !== 404) {
        throw new Error(
          await extractApiError(
            profileResponse,
            `Error al cargar profiles/me: ${profileResponse.status}`
          )
        );
      }

      setProfile(buildProfileFromBackend(authData, backendProfile));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido al cargar el perfil.";
      setError(errorMessage);
      console.error("Error en useProfile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, fetchFromProfileApi]);

  const updateProfile = async (data: Partial<PerfilCompleto>) => {
    if (!backendUrl || typeof window === "undefined") return;

    const token = getTokenOrThrow();
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
      console.error("Error actualizando perfil:", err);
      throw err;
    }
  };

  const addExperience = async (experience: Experience) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: POST /api/profiles/me/experiences
      console.warn("Endpoint /api/profiles/me/experiences no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => {
        if (!prev) return null;
        const newExperience = { ...experience, id: Date.now().toString() };
        return {
          ...prev,
          experiencias: [...prev.experiencias, newExperience]
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
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: PUT /api/profiles/me/experiences/:id
      console.warn("Endpoint /api/profiles/me/experiences/:id no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          experiencias: prev.experiencias.map(exp => 
            exp.id === id ? { ...experience, id } : exp
          )
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
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: DELETE /api/profiles/me/experiences/:id
      console.warn("Endpoint /api/profiles/me/experiences/:id no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          experiencias: prev.experiencias.filter(exp => exp.id !== id)
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
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: POST /api/profiles/me/skills
      console.warn("Endpoint /api/profiles/me/skills no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => {
        if (!prev) return null;
        const newSkill = { ...skill, id: Date.now().toString() };
        return {
          ...prev,
          habilidades: [...prev.habilidades, newSkill]
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
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: PUT /api/profiles/me/skills/:id
      console.warn("Endpoint /api/profiles/me/skills/:id no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          habilidades: prev.habilidades.map(s => 
            s.id === id ? { ...skill, id } : s
          )
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
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: DELETE /api/profiles/me/skills/:id
      console.warn("Endpoint /api/profiles/me/skills/:id no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          habilidades: prev.habilidades.filter(s => s.id !== id)
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
