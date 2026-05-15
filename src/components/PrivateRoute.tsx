import { useEffect, ReactNode, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/hooks/useSession";
import { getAccessToken } from "@/utils/session";

type PrivateRouteProps = {
  children: ReactNode;
};

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const hasToken = typeof window !== "undefined" && Boolean(getAccessToken());
  const canAccess = isAuthenticated || hasToken;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/login");
    }
  }, [canAccess, isLoading, router]);

  if (!isMounted || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-sm text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-slate-50" />
    );
  }

  return <>{children}</>;
};

export default PrivateRoute;
