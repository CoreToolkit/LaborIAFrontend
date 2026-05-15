import React from "react";
import { Edit2, Target, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PerfilCompleto } from "@/types/profile";

interface Props {
  profile: PerfilCompleto;
  onEditPreferences: () => void;
}

export function ProfilePreferencesTab({ profile, onEditPreferences }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Preferencias Laborales</h3>
        <Button size="sm" onClick={onEditPreferences}>
          <Edit2 className="w-4 h-4 mr-2" />
          Editar Preferencias
        </Button>
      </div>

      {profile.preferencias ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {profile.preferencias.cargo && (
            <div>
              <p className="text-sm text-slate-500 font-medium mb-2">Cargo Deseado</p>
              <p className="text-slate-900">{profile.preferencias.cargo}</p>
            </div>
          )}

          {profile.preferencias.industria && (
            <div>
              <p className="text-sm text-slate-500 font-medium mb-2">Industria</p>
              <p className="text-slate-900">{profile.preferencias.industria}</p>
            </div>
          )}

          {profile.preferencias.ubicacion && (
            <div>
              <p className="text-sm text-slate-500 font-medium mb-2">Ubicación Preferida</p>
              <p className="text-slate-900">{profile.preferencias.ubicacion}</p>
            </div>
          )}

          {profile.preferencias.salarioEsperado && (
            <div>
              <p className="text-sm text-slate-500 font-medium mb-2">Salario Esperado</p>
              <p className="text-slate-900">${profile.preferencias.salarioEsperado.toLocaleString()}</p>
            </div>
          )}

          {profile.preferencias.tipoContrato && (
            <div>
              <p className="text-sm text-slate-500 font-medium mb-2">Tipo de Contrato</p>
              <p className="text-slate-900">{profile.preferencias.tipoContrato}</p>
            </div>
          )}

          {typeof profile.preferencias.disponibilidadInmediata === "boolean" && (
            <div>
              <p className="text-sm text-slate-500 font-medium mb-2">Disponibilidad</p>
              <p className="text-slate-900">
                {profile.preferencias.disponibilidadInmediata ? "Inmediata" : "A convenir"}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Target className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">No has configurado tus preferencias laborales</p>
          <Button size="sm" onClick={onEditPreferences}>
            <Settings className="w-4 h-4 mr-2" />
            Configurar Preferencias
          </Button>
        </div>
      )}
    </div>
  );
}
