import { useCallback, useEffect, useState } from "react";
import { getTimelineSummary } from "@/services/metricsService";
import { TimelineSummary } from "@/types/metrics";
import { getAccessToken } from "@/utils/session";

type Granularity = "week" | "month";

export interface UseTimelineSummaryResult {
  data: TimelineSummary | null;
  isLoading: boolean;
  error: string | null;
}

export function useTimelineSummary(granularity: Granularity): UseTimelineSummaryResult {
  const [data, setData] = useState<TimelineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (g: Granularity, signal: AbortSignal) => {
    const token = getAccessToken();
    if (!token) {
      setError("Sesión expirada. Inicia sesión nuevamente.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getTimelineSummary(token, g, signal);
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(granularity, controller.signal);
    return () => controller.abort();
  }, [load, granularity]);

  return { data, isLoading, error };
}
