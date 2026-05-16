import React from "react";
import { TrendingUp, Award, Trophy } from "lucide-react";
import { PerfilCompleto } from "@/types/profile";

interface ProfileStatsTabProps {
  profile: PerfilCompleto;
}

const getAchievementProgressValue = (actual: number, required: number): number => {
  const safeRequired = Number.isFinite(required) && required > 0 ? required : 1;
  const safeActual = Number.isFinite(actual) && actual > 0 ? actual : 0;
  return Math.min(safeActual, safeRequired);
};

export function ProfileStatsTab({ profile }: ProfileStatsTabProps) {
  if (!profile.estadisticas) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-900">Estadísticas de Entrenamiento</h3>
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">Aún no tienes estadísticas disponibles</p>
          <p className="text-slate-500 text-sm">Comienza a practicar entrevistas para ver tu progreso</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-900">Estadísticas de Entrenamiento</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-blue-700 font-medium">Entrevistas Realizadas</p>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {profile.estadisticas.entrevistasRealizadas}
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-green-700 font-medium">Nivel Promedio</p>
            <Award className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">
            {profile.estadisticas.nivelPromedio}%
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-purple-700 font-medium">Racha Actual</p>
            <Trophy className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-900">
            {profile.estadisticas.rachaActual} días
          </p>
        </div>
      </div>

      {profile.logros && profile.logros.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Logros Desbloqueados</h4>
          <div className="grid grid-cols-3 gap-4">
            {profile.logros.map((logro, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  logro.desbloqueado
                    ? "bg-blue-50 border-blue-300"
                    : "bg-slate-50 border-slate-200 opacity-60"
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">{logro.icono}</div>
                  <h5 className="font-semibold text-slate-900 text-sm">{logro.nombre}</h5>
                  <p className="text-xs text-slate-600 mt-1">{logro.descripcion}</p>
                  {logro.desbloqueado && logro.fechaDesbloqueo && (
                    <p className="text-xs text-slate-500 mt-2">
                      Desbloqueado: {new Date(logro.fechaDesbloqueo).toLocaleDateString()}
                    </p>
                  )}
                  {!logro.desbloqueado && (
                    <div className="mt-2">
                      <progress
                        className="h-1.5 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-blue-600"
                        max={Math.max(logro.progresoRequerido, 1)}
                        value={getAchievementProgressValue(logro.progresoActual, logro.progresoRequerido)}
                        aria-label={`Progreso de ${logro.nombre}`}
                      />
                      <p className="text-xs text-slate-600 mt-1">
                        {logro.progresoActual} / {logro.progresoRequerido}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
