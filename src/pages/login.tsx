import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { LoginForm } from '@/components/LoginForm';
import LightRays from '@/components/ui/LightRays';
import { useSession } from '@/hooks/useSession';
import { getAccessToken } from '@/utils/session';

export default function Login() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading && (isAuthenticated || Boolean(getAccessToken()))) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <>
      <Head>
        <title>Iniciar Sesión - LaborIA</title>
        <meta name="description" content="Inicia sesión en LaborIA para potenciar tu carrera con Inteligencia Artificial" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen flex">
        {/* Panel Izquierdo - Formulario de Login */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <LoginForm />
        </div>

        {/* Panel Derecho - Mensaje Inspiracional con LightRays */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-slate-900">
          <div className="absolute inset-0">
            <LightRays
              raysOrigin="top-center"
              raysColor="#ffffff"
              raysSpeed={1}
              lightSpread={0.5}
              rayLength={3}
              followMouse={true}
              mouseInfluence={0.1}
              noiseAmount={0}
              distortion={0}
              pulsating={false}
              fadeDistance={1}
              saturation={1}
            />
          </div>

          {/* Contenido */}
          <div className="relative z-10 flex flex-col items-center justify-center text-white p-12 max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Potencia tu carrera con Inteligencia Artificial
            </h2>
            <p className="text-lg md:text-xl opacity-90 leading-relaxed">
              Analizamos tu perfil, identificamos tus brechas de habilidades y te preparamos
              para las entrevistas del futuro. El siguiente nivel de tu carrera comienza aquí.
            </p>
          </div>

          {/* Efecto de brillo sutil */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl" />
        </div>
      </div>
    </>
  );
}
