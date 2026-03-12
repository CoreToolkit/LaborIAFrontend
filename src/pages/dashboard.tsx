import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  LogOut, 
  Bell, 
  Settings,
  User 
} from 'lucide-react';
import { clearTokens, clearProvider, getAccessToken } from '@/utils/session';
import PrivateRoute from "@/components/PrivateRoute";

export default function Dashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    const accessToken = getAccessToken();

    try {
      if (!accessToken) {
        clearTokens();
        clearProvider();
        router.push('/login');
        return;
      }

      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        console.error('Logout respondió con error HTTP:', res.status);
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      clearTokens();
      clearProvider();
      router.push('/login');
    }
  };

  return (
    //<PrivateRoute>
      <>
        <Head>
          <title>Dashboard - LaborIA</title>
          <meta name="description" content="Panel de control de LaborIA" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                {/* Logo */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-semibold">LaborIA</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 ">
                  <button 
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Notificaciones"
                    title="Notificaciones"
                  >
                    <Bell className="w-5 h-5 text-gray-600" />
                  </button>
                  <button 
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Configuración"
                    title="Configuración"
                  >
                    <Settings className="w-5 h-5 text-gray-600" />
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/profile')}
                    className="gap-2 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Mi Perfil
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2 cursor-pointer hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Welcome Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                ¡Bienvenido de nuevo! 👋
              </h1>
              <p className="text-gray-600">
                Aquí está tu progreso de carrera y las próximas acciones recomendadas.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Stat Card 1 */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-35 flex items-center justify-center">
                <p className="text-gray-500 text-center">Estadística 1</p>
              </div>

              {/* Stat Card 2 */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-35 flex items-center justify-center">
                <p className="text-gray-500 text-center">Estadística 2</p>
              </div>

              {/* Stat Card 3 */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-35 flex items-center justify-center">
                <p className="text-gray-500 text-center">Estadística 3</p>
              </div>

              {/* Stat Card 4 */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-35 flex items-center justify-center">
                <p className="text-gray-500 text-center">Estadística 4</p>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Sección Principal 1 */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-75">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Contenido Principal
                  </h2>
                  <div className="flex items-center justify-center h-48">
                    <p className="text-gray-400 text-center">
                      Aquí irá el contenido principal de la sección
                    </p>
                  </div>
                </div>

                {/* Sección Principal 2 */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-75">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Contenido Secundario
                  </h2>
                  <div className="flex items-center justify-center h-48">
                    <p className="text-gray-400 text-center">
                      Aquí irá contenido adicional
                    </p>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Widget Sidebar 1 */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-62.5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Widget Lateral
                  </h2>
                  <div className="flex items-center justify-center h-32">
                    <p className="text-gray-400 text-center text-sm">
                      Información complementaria
                    </p>
                  </div>
                </div>

                {/* Widget Sidebar 2 */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-50">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Acciones Rápidas
                  </h2>
                  <div className="flex items-center justify-center h-24">
                    <p className="text-gray-400 text-center text-sm">
                      Opciones adicionales
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </>
    //</PrivateRoute>
  );
}
