import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { LoginForm } from '@/components/LoginForm';
import { useSession } from '@/hooks/useSession';
import { getAccessToken } from '@/utils/session';

const HORIZONTAL_TOP_CLASSES = [
  'top-[3%]',
  'top-[8%]',
  'top-[12%]',
  'top-[17%]',
  'top-[23%]',
  'top-[29%]',
  'top-[34%]',
  'top-[41%]',
  'top-[47%]',
  'top-[53%]',
  'top-[59%]',
  'top-[66%]',
  'top-[72%]',
  'top-[79%]',
  'top-[86%]',
  'top-[93%]',
];

const VERTICAL_LEFT_CLASSES = [
  'left-[2%]',
  'left-[7%]',
  'left-[13%]',
  'left-[18%]',
  'left-[24%]',
  'left-[31%]',
  'left-[37%]',
  'left-[43%]',
  'left-[49%]',
  'left-[55%]',
  'left-[61%]',
  'left-[67%]',
  'left-[73%]',
  'left-[79%]',
  'left-[85%]',
  'left-[92%]',
];

const DURATION_CLASSES = [
  '[animation-duration:2s]',
  '[animation-duration:2.6s]',
  '[animation-duration:3.2s]',
  '[animation-duration:3.8s]',
  '[animation-duration:4.4s]',
];

const DELAY_CLASSES = [
  '[animation-delay:0s]',
  '[animation-delay:0.25s]',
  '[animation-delay:0.5s]',
  '[animation-delay:0.75s]',
  '[animation-delay:1s]',
  '[animation-delay:1.25s]',
  '[animation-delay:1.5s]',
  '[animation-delay:1.75s]',
];

const MATRIX_LINE_COUNT = 30;

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

        {/* Panel Derecho - Mensaje Inspiracional */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-linear-to-br from-blue-600 via-indigo-600 to-purple-600">
          {/* Efecto de líneas de matriz */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 matrix-grid" />
            {/* Líneas animadas */}
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: MATRIX_LINE_COUNT }, (_, index) => (
                <div
                  key={`h-${index}`}
                  className={`absolute h-0.5 left-0 right-0 bg-linear-to-r from-transparent via-white to-transparent opacity-70 matrix-line-shadow matrix-horizontal ${HORIZONTAL_TOP_CLASSES[index % HORIZONTAL_TOP_CLASSES.length]} ${DURATION_CLASSES[index % DURATION_CLASSES.length]} ${DELAY_CLASSES[index % DELAY_CLASSES.length]}`}
                />
              ))}
              {Array.from({ length: MATRIX_LINE_COUNT }, (_, index) => (
                <div
                  key={`v-${index}`}
                  className={`absolute w-0.5 top-0 bottom-0 bg-linear-to-b from-transparent via-white to-transparent opacity-60 matrix-line-shadow matrix-vertical ${VERTICAL_LEFT_CLASSES[index % VERTICAL_LEFT_CLASSES.length]} ${DURATION_CLASSES[(index + 1) % DURATION_CLASSES.length]} ${DELAY_CLASSES[(index + 2) % DELAY_CLASSES.length]}`}
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
        .matrix-grid {
          background-image:
            repeating-linear-gradient(
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
            );
        }

        .matrix-line-shadow {
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
        }

        .matrix-horizontal {
          animation-name: slideRight;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .matrix-vertical {
          animation-name: slideDown;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

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
