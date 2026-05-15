import { useEffect } from "react";
import { useRouter } from "next/router";
import {
  getProvider,
  getAccessToken,
  clearProvider,
  saveTokens,
  clearTokens,
} from "@/utils/session";
import { exchangeOAuthCode } from "@/services/authService";

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const code = router.query.code as string | undefined;
    const state = router.query.state as string | undefined;
    const oauthError = router.query.error as string | undefined;
    const provider = getProvider();
    const existingToken = getAccessToken();

    const cleanup = (removeTokens = false) => {
      clearProvider();
      if (removeTokens) clearTokens();
    };

    if (oauthError) {
      console.error("El proveedor devolvió un error:", oauthError);
      if (existingToken) {
        cleanup(false);
        router.replace("/dashboard");
        return;
      }
      cleanup(true);
      router.replace("/login");
      return;
    }

    if (!code) {
      if (existingToken) {
        cleanup(false);
        router.replace("/dashboard");
        return;
      }
      cleanup(false);
      router.replace("/login");
      return;
    }

    if (!provider) {
      if (existingToken) {
        cleanup(false);
        router.replace("/dashboard");
        return;
      }
      cleanup(true);
      router.replace("/login");
      return;
    }

    exchangeOAuthCode(provider, code, state)
      .then((data) => {
        saveTokens(data.access_token, data.refresh_token);
        cleanup(false);
        router.replace("/dashboard");
      })
      .catch((error) => {
        console.error("Error en el proceso de autenticación:", error);
        if (existingToken) {
          cleanup(false);
          router.replace("/dashboard");
          return;
        }
        cleanup(true);
        router.replace("/login");
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="text-sm text-slate-600">Iniciando sesión...</p>
      </div>
    </div>
  );
}
