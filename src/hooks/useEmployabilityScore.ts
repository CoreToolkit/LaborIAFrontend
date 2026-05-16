import { useCallback, useEffect, useState } from "react";
import { getEmployabilityScore } from "@/services/metricsService";
import { EmployabilityScoreResponse } from "@/types/metrics";
import { getAccessToken } from "@/utils/session";

export interface UseEmployabilityScoreResult {
  data: EmployabilityScoreResponse | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useEmployabilityScore(): UseEmployabilityScoreResult {
  const [data, setData] = useState<EmployabilityScoreResponse | null>(null);
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
      const result = await getEmployabilityScore(token);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "No se pudo cargar el score de empleabilidad."
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
