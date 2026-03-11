import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Provider,
  getProvider,
  clearProvider,
  saveTokens,
  clearTokens,
} from "@/utils/session";

export default function Callback() {
  const router = useRouter();
  const [message, setMessage] = useState("Iniciando sesión...");

  useEffect(() => {
    if (!router.isReady) return;

    const code = router.query.code as string | undefined;
    const state = router.query.state as string | undefined;
    const oauthError = router.query.error as string | undefined;
    const provider = getProvider();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    const cleanup = (removeTokens = false) => {
      clearProvider();
      if (removeTokens) clearTokens();
    };

    if (oauthError) {
      console.error("El proveedor devolvió un error:", oauthError);
      setMessage("El proveedor devolvió un error. Intenta nuevamente.");
      cleanup(true);
      router.replace("/login");
      return;
    }

    if (!code) {
      setMessage("No se recibió el código de autorización.");
      cleanup(true);
      router.replace("/login");
      return;
    }

    if (!provider) {
      setMessage("No se encontró el proveedor en la sesión.");
      cleanup(true);
      router.replace("/login");
      return;
    }

    if (!backendUrl) {
      console.error("NEXT_PUBLIC_BACKEND_URL no está definida.");
      setMessage("Configuración incompleta. Falta la URL del backend.");
      cleanup(true);
      return;
    }

    const exchangeUrl = `${backendUrl}/auth/${provider}/exchange`;

    fetch(exchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        state,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.access_token || !data?.refresh_token) {
          throw new Error("La respuesta no contiene tokens.");
        }

        saveTokens(data.access_token, data.refresh_token);
        cleanup(false);

        router.push("/dashboard");
      })
      .catch((error) => {
        console.error("Error en el proceso de autenticación:", error);
        setMessage("No se pudo completar la autenticación. Intenta nuevamente.");
        cleanup(true);
        router.replace("/login");
      });
  }, [router]);

  return <p>{message}</p>;
}
