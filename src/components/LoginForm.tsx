import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { Provider, setProvider, clearProvider } from '@/utils/session';

export const LoginForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const startOAuth = async (provider: Provider) => {
    setAuthError(null);
    setIsSubmitting(true);

    try {
      if (!backendUrl) {
        throw new Error(
          'backendUrl no está definida. Asegúrate de tener NEXT_PUBLIC_BACKEND_URL en tu entorno.'
        );
      }

      const authUrl = `${backendUrl}/auth/${provider}`;
      setProvider(provider);

      const res = await fetch(authUrl);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      if (!data?.url) {
        throw new Error('La respuesta del backend no contiene la URL de autenticación.');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
      setAuthError((error as Error).message || 'No se pudo iniciar sesión con OAuth.');
      clearProvider();
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => startOAuth('google');
  const handleMicrosoftLogin = () => startOAuth('microsoft');

  return (
    <div className="w-full max-w-md space-y-6 ">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <Clock className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-semibold text-foreground">LaborIA</span>
      </div>

      {/* Título */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Bienvenido de nuevo</h1>
        <p className="text-sm text-muted-foreground">
          Inicia sesión con tu cuenta de Google o Microsoft.
        </p>
      </div>

      {/* Contenedor con borde para el formulario completo */}
      <div className="p-8 border border-border rounded-lg bg-card shadow-sm space-y-6">
        {authError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {authError}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          LaborIA utiliza autenticación por OAuth. Selecciona un proveedor para continuar.
        </p>

        {/* Botones de redes sociales */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleMicrosoftLogin}
            disabled={isSubmitting}
            className="w-full cursor-pointer hover:bg-blue-600 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#f35325" d="M0 0h11.377v11.372H0z" />
              <path fill="#81bc06" d="M12.623 0H24v11.372H12.623z" />
              <path fill="#05a6f0" d="M0 12.628h11.377V24H0z" />
              <path fill="#ffba08" d="M12.623 12.628H24V24H12.623z" />
            </svg>
            Microsoft
          </Button>
        </div>
      </div>
    </div>
  );
};
