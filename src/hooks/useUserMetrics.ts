import { useCallback, useEffect, useState } from "react";
import { getUserMetrics } from "@/services/metricsService";
import { UserMetricsResponse } from "@/types/metrics";
import { getAccessToken } from "@/utils/session";

export interface UseUserMetricsResult {
  data: UserMetricsResponse | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useUserMetrics(): UseUserMetricsResult {
  const [data, setData] = useState<UserMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError("Sesión expirada. Inicia sesión nuevamente.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await getUserMetrics(token);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "No se pudo cargar las métricas del usuario."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
