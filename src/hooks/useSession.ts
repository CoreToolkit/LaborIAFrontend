import { useEffect, useState } from "react";
import { getAccessToken, SESSION_CHANGED_EVENT } from "@/utils/session";

type SessionState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

export function useSession(): SessionState {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(getAccessToken());
  });
  const [isLoading, setIsLoading] = useState(() => typeof window === "undefined");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncSession = () => {
      const token = getAccessToken();
      setIsAuthenticated(Boolean(token));
      setIsLoading(false);
    };

    syncSession();

    // Keep auth state in sync for browser navigation and token updates.
    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);
    window.addEventListener("pageshow", syncSession);
    window.addEventListener("popstate", syncSession);
    window.addEventListener(SESSION_CHANGED_EVENT, syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
      window.removeEventListener("pageshow", syncSession);
      window.removeEventListener("popstate", syncSession);
      window.removeEventListener(SESSION_CHANGED_EVENT, syncSession);
    };
  }, []);

  return { isAuthenticated, isLoading };
}
