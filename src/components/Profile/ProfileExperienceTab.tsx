import React from "react";
import { Briefcase, Building, Calendar, MapPin, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PerfilCompleto, Experience } from "@/types/profile";

interface ProfileExperienceTabProps {
  profile: PerfilCompleto;
  onAdd: () => void;
  onEdit: (experience: Experience) => void;
  onDelete: (id: string) => Promise<void>;
}

export function ProfileExperienceTab({ profile, onAdd, onEdit, onDelete }: ProfileExperienceTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Experiencia Laboral</h3>
        <Button size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Experiencia
        </Button>
      </div>

      {profile.experiencias && profile.experiencias.length > 0 ? (
        <div className="space-y-4">
          {profile.experiencias.map((exp, index) => (
            <div
              key={exp.id ?? index}
              className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
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
                    className="p-1 text-gray-400 hover:text-blue-600"
                    onClick={() => onEdit(exp)}
                    aria-label="Editar experiencia"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1 text-gray-400 hover:text-red-600"
                    onClick={() => exp.id && onDelete(exp.id)}
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
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar tu primera experiencia
          </Button>
        </div>
      )}
    </div>
  );
}
