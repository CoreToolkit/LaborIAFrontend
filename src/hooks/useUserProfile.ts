import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { clearTokens, getAccessToken } from "@/utils/session";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  provider?: string;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Función auxiliar para capitalizar nombres
function capitalizeName(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Función auxiliar para decodificar JWT
function decodeJWT(token: string): UserProfile | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );
    
    // Log temporal para ver todos los datos del JWT
    console.log('📦 Contenido completo del JWT:', decodedPayload);
    console.log('📋 Campos disponibles:', Object.keys(decodedPayload));
    
    // Mapear los campos del JWT a nuestro UserProfile
    const rawName = decodedPayload.name || decodedPayload.given_name || decodedPayload.email || '';
    const rawGivenName = decodedPayload.given_name;
    const rawFamilyName = decodedPayload.family_name;
    
    // Buscar la imagen en todos los campos posibles
    const picture = decodedPayload.picture || 
                    decodedPayload.avatar || 
                    decodedPayload.photo || 
                    decodedPayload.image ||
                    decodedPayload.avatar_url ||
                    decodedPayload.profile_picture;
    
    return {
      id: decodedPayload.sub || decodedPayload.id || decodedPayload.user_id || '',
      email: decodedPayload.email || '',
      name: rawName ? capitalizeName(rawName) : '',
      given_name: rawGivenName ? capitalizeName(rawGivenName) : undefined,
      family_name: rawFamilyName ? capitalizeName(rawFamilyName) : undefined,
      picture: picture, // Usar la URL original sin modificar
      locale: decodedPayload.locale,
      provider: decodedPayload.provider || 'google',
    };
  } catch (error) {
    console.error('Error decodificando JWT:', error);
    return null;
  }
}

export function useUserProfile(): UseUserProfileResult {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const token = getAccessToken();

    if (!backendUrl) {
      setError("Configuración incompleta. Falta la URL del backend.");
      setIsLoading(false);
      return;
    }

    if (!token) {
      clearTokens();
      setProfile(null);
      setError(null);
      router.replace("/login");
      setIsLoading(false);
      return;
    }

    try {
      // Intentar obtener el perfil desde el backend usando /auth/me
      const response = await fetch(`${backendUrl}/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearTokens();
          setProfile(null);
          setError(null);
          router.replace("/login");
          setIsLoading(false);
          return;
        }
        if (response.status === 404) {
          // Si el endpoint no existe, usar el JWT como fallback
          const decoded = decodeJWT(token);
          if (decoded && decoded.email && decoded.name) {
            setProfile(decoded);
            setIsLoading(false);
            return;
          }
          throw new Error("No se encontró el perfil del usuario.");
        }
        throw new Error(`Error al cargar el perfil: ${response.status}`);
      }

      const data = await response.json();
      
      // Capitalizar el nombre si viene en minúsculas
      if (data.name) {
        data.name = capitalizeName(data.name);
      }
      if (data.given_name) {
        data.given_name = capitalizeName(data.given_name);
      }
      if (data.family_name) {
        data.family_name = capitalizeName(data.family_name);
      }
      
      setProfile(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido al cargar el perfil.";
      setError(errorMessage);
      console.error("Error en useUserProfile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
  };
}
