import React from 'react';
import Head from 'next/head';
import { LoginForm } from '@/components/LoginForm';

export default function Login() {
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
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="absolute h-0.5 bg-linear-to-r from-transparent via-white to-transparent opacity-70"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: 0,
                    right: 0,
                    animation: `slideRight ${2 + Math.random() * 3}s linear infinite`,
                    animationDelay: `${Math.random() * 2}s`,
                    boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
                  }}
                />
              ))}
              {[...Array(30)].map((_, i) => (
                <div
                  key={`v-${i}`}
                  className="absolute w-0.5 bg-linear-to-b from-transparent via-white to-transparent opacity-60"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: 0,
                    bottom: 0,
                    animation: `slideDown ${2 + Math.random() * 3}s linear infinite`,
                    animationDelay: `${Math.random() * 2}s`,
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
