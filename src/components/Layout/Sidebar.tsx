import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  UserCircle,
  Target,
  MessageSquare,
  TrendingUp,
  MapPin,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { clearProvider, clearTokens } from '@/utils/session';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Mi Perfil Profesional', href: '/profile', icon: UserCircle },
  { name: 'Matching Roles', href: '/matching', icon: Target },
  { name: 'Simulador Entrevista', href: '/interview', icon: MessageSquare },
  { name: 'Métricas de Progreso', href: '/progress', icon: TrendingUp },
  { name: 'Plan de Mejora', href: '/plan', icon: MapPin },
];

const secondaryNavigation = [
  { name: 'Configuración', href: '/settings', icon: Settings },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearTokens();
    clearProvider();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed left-0 top-0 z-40 h-full w-64 transform overflow-y-auto border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
              L
            </div>
            <span className="text-xl font-bold text-slate-900">LaborIA</span>
            {/* Close button for mobile */}
            {isOpen && (
              <button
                onClick={onClose}
                type="button"
                aria-label="Cerrar menú"
                title="Cerrar menú"
                className="ml-auto lg:hidden"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex-1 px-3 py-4">
            {/* Main Menu */}
            <div className="mb-8">
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Menú Principal
              </h3>
              <ul className="space-y-1">
                {navigation.map((item) => {
                  const isActive = router.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* System Menu */}
            <div>
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Sistema
              </h3>
              <ul className="space-y-1">
                {secondaryNavigation.map((item) => {
                  const isActive = router.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Logout button */}
          <div className="border-t border-slate-200 px-3 py-4">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
            >
              <LogOut className="h-5 w-5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
