import { useEffect, useState } from "react";
import { getAccessToken } from "@/utils/session";

type SessionState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

export function useSession(): SessionState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ejecutar solo en cliente para evitar errores de SSR con localStorage.
    if (typeof window === "undefined") return;

    const token = getAccessToken();
    setIsAuthenticated(Boolean(token));
    setIsLoading(false);
  }, []);

  return { isAuthenticated, isLoading };
}
