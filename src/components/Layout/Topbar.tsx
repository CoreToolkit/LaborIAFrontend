import React from 'react';
import { Search, Bell, Menu, User } from 'lucide-react';
import { useRouter } from 'next/router';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 shadow-sm">
      {/* Left side - Menu & Logo for mobile */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
            L
          </div>
          <span className="font-bold text-slate-900">LaborIA</span>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden flex-1 items-center justify-center px-12 lg:flex">
        <div className="w-full max-w-lg">
          <label htmlFor="search" className="sr-only">
            Buscar
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="search"
              type="search"
              placeholder="Buscar roles, entrevistas, cursos..."
              className="block w-full rounded-lg border-0 bg-slate-100 py-2 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-600 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative rounded-full p-1.5 text-slate-400 hover:text-slate-500 hover:bg-slate-100 transition-colors">
          <span className="absolute right-1 top-1 flex h-2 w-2 items-center justify-center rounded-full bg-blue-600 ring-2 ring-white" />
          <Bell className="h-5 w-5" />
        </button>

        {/* User profile */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="hidden flex-col text-right sm:block">
            <span className="block text-sm font-semibold text-slate-900">Juan Pérez</span>
            <span className="block text-xs text-slate-500">Junior Developer</span>
          </div>
          <button className="flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-slate-300 transition-all">
            <img
              className="h-9 w-9 rounded-full bg-slate-100 object-cover ring-1 ring-slate-200"
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=facearea&facepad=2&w=256&h=256&q=80"
              alt="Usuario"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
