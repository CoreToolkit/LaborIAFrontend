import React, { useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { LoginForm } from '@/components/LoginForm';
import { useSession } from '@/hooks/useSession';
import { getAccessToken } from '@/utils/session';

const seededRandom = (seed: number): number => {
  const value = Math.sin(seed * 9999) * 10000;
  return value - Math.floor(value);
};

export default function Login() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSession();

  const horizontalLines = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        key: `h-${i}`,
        top: `${seededRandom(i + 1) * 100}%`,
        animationDuration: `${2 + seededRandom(i + 101) * 3}s`,
        animationDelay: `${seededRandom(i + 201) * 2}s`,
      })),
    []
  );

  const verticalLines = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        key: `v-${i}`,
        left: `${seededRandom(i + 301) * 100}%`,
        animationDuration: `${2 + seededRandom(i + 401) * 3}s`,
        animationDelay: `${seededRandom(i + 501) * 2}s`,
      })),
    []
  );

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

        {/* Panel Derecho - Mensaje Inspiracional */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-linear-to-br from-blue-600 via-indigo-600 to-purple-600">
          {/* Efecto de líneas de matriz */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(255, 255, 255, 0.08) 2px,
                rgba(255, 255, 255, 0.08) 4px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 2px,
                rgba(255, 255, 255, 0.08) 2px,
                rgba(255, 255, 255, 0.08) 4px
              )`
            }}>
            </div>
            {/* Líneas animadas */}
            <div className="absolute inset-0 overflow-hidden">
              {horizontalLines.map((line) => (
                <div
                  key={line.key}
                  className="absolute h-0.5 bg-linear-to-r from-transparent via-white to-transparent opacity-70"
                  style={{
                    top: line.top,
                    left: 0,
                    right: 0,
                    animation: `slideRight ${line.animationDuration} linear infinite`,
                    animationDelay: line.animationDelay,
                    boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
                  }}
                />
              ))}
              {verticalLines.map((line) => (
                <div
                  key={line.key}
                  className="absolute w-0.5 bg-linear-to-b from-transparent via-white to-transparent opacity-60"
                  style={{
                    left: line.left,
                    top: 0,
                    bottom: 0,
                    animation: `slideDown ${line.animationDuration} linear infinite`,
                    animationDelay: line.animationDelay,
                    boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
                  }}
                />
              ))}
            </div>
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

      <style jsx>{`
        @keyframes slideRight {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(100%);
          }
        }
      `}</style>
    </>
  );
}
