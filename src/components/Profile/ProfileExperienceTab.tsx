import React from "react";
import { Building, Calendar, MapPin, Edit2, Trash2, Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Experience, PerfilCompleto } from "@/types/profile";

interface Props {
  profile: PerfilCompleto;
  onAddExperience: () => void;
  onEditExperience: (experience: Experience) => void;
  onDeleteExperience: (id: string) => void;
}

export function ProfileExperienceTab({ profile, onAddExperience, onEditExperience, onDeleteExperience }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Experiencia Laboral</h3>
        <Button size="sm" onClick={onAddExperience}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Experiencia
        </Button>
      </div>

      {profile.experiencias && profile.experiencias.length > 0 ? (
        <div className="space-y-4">
          {profile.experiencias.map((exp, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{exp.cargo}</h4>
                    <p className="text-slate-600">{exp.empresa}</p>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {exp.fechaInicio} - {exp.esActual ? "Presente" : exp.fechaFin}
                      </span>
                      {exp.ubicacion && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {exp.ubicacion}
                        </span>
                      )}
                    </div>
                    {exp.descripcion && (
                      <p className="text-slate-700 mt-2 text-sm">{exp.descripcion}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-blue-600"
                    onClick={() => onEditExperience(exp)}
                    aria-label="Editar experiencia"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-red-600"
                    onClick={() => exp.id && onDeleteExperience(exp.id)}
                    aria-label="Eliminar experiencia"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">No has agregado experiencia laboral aún</p>
          <Button size="sm" onClick={onAddExperience}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar tu primera experiencia
          </Button>
        </div>
      )}
    </div>
  );
}
