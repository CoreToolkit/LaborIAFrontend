import { useEffect, useState } from "react";
import { getAccessToken } from "@/utils/session";
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

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<PerfilCompleto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const fetchProfile = async () => {
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

    const token = getAccessToken();
    
    if (!token) {
      setError("No se encontró el token de autenticación.");
      setIsLoading(false);
      return;
    }

    try {
      // Usar el endpoint /auth/me que existe actualmente
      // TODO: Cuando el backend implemente /api/profiles/me, cambiar a ese endpoint
      const response = await fetch(`${backendUrl}/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Sesión expirada. Por favor, inicia sesión nuevamente.");
        }
        throw new Error(`Error al cargar el perfil: ${response.status}`);
      }

      const data = await response.json();
      
      // Mapear los datos del backend al formato esperado por el frontend
      const perfilCompleto: PerfilCompleto = {
        id: data.id || data.sub || '',
        email: data.email || '',
        nombre: data.name || data.given_name || '',
        fotoPerfil: data.picture || data.avatar || undefined,
        telefono: data.telefono || undefined,
        ubicacion: data.ubicacion || undefined,
        carrera: data.carrera || undefined,
        universidad: data.universidad || undefined,
        fechaGraduacion: data.fechaGraduacion || data.fecha_graduacion || undefined,
        bio: data.bio || data.descripcion || undefined,
        nivelIngles: data.nivelIngles || data.nivel_ingles || undefined,
        experiencias: data.experiencias || [],
        habilidades: data.habilidades || [],
        preferencias: data.preferencias || undefined,
        estadisticas: data.estadisticas || undefined,
        logros: data.logros || [],
        redesSociales: data.redesSociales || undefined,
        cvUrl: data.cvUrl || undefined,
      };
      
      setProfile(perfilCompleto);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido al cargar el perfil.";
      setError(errorMessage);
      console.error("Error en useProfile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<PerfilCompleto>) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: PATCH /api/profiles/me
      console.warn("Endpoint /api/profiles/me no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => prev ? { ...prev, ...data } : null);
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
            (exp as any).id === id ? { ...experience, id } : exp
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
          experiencias: prev.experiencias.filter(exp => (exp as any).id !== id)
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
            (s as any).id === id ? { ...skill, id } : s
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
          habilidades: prev.habilidades.filter(s => (s as any).id !== id)
        };
      });
    } catch (err) {
      console.error("Error eliminando skill:", err);
      throw err;
    }
  };

  const updatePreferencias = async (preferencias: Preferencias) => {
    if (!backendUrl || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;

    try {
      // TODO: Implementar endpoint en el backend: PUT /api/profiles/me/preferencias
      console.warn("Endpoint /api/profiles/me/preferencias no implementado aún en el backend");
      
      // Actualizar localmente mientras tanto
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          preferencias
        };
      });
    } catch (err) {
      console.error("Error actualizando preferencias:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

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
