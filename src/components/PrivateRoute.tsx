import { useEffect, ReactNode } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/hooks/useSession";
import { getAccessToken } from "@/utils/session";

type PrivateRouteProps = {
  children: ReactNode;
};

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSession();
  const hasToken = typeof window !== "undefined" && Boolean(getAccessToken());
  const canAccess = isAuthenticated || hasToken;

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/login");
    }
  }, [canAccess, isLoading, router]);

  if (isLoading) return null;
  if (!canAccess) return null;

  return <>{children}</>;
};

export default PrivateRoute;
