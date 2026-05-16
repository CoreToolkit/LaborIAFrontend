import { useCallback, useEffect, useState } from "react";
import { getRoleDetail } from "@/services/matchingService";
import { RoleDetail } from "@/types/matching";
import { getAccessToken } from "@/utils/session";

export interface UseRoleDetailResult {
  detail: RoleDetail | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useRoleDetail(roleId: string | null, isOpen: boolean): UseRoleDetailResult {
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!roleId || !isOpen) return;

    const token = getAccessToken();
    if (!token) {
      setError("Tu sesión no es válida. Inicia sesión nuevamente.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDetail(null);

    try {
      const payload = await getRoleDetail(roleId, token);
      setDetail(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el detalle del rol.");
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [roleId, isOpen]);

  useEffect(() => {
    if (!roleId || !isOpen) {
      setDetail(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    void fetchDetail();
  }, [roleId, isOpen, fetchDetail]);

  return { detail, isLoading, error, reload: fetchDetail };
}
