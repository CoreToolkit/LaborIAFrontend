import React from "react";
import { Edit2, Trash2, Star, Award, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PerfilCompleto, Skill } from "@/types/profile";

interface Props {
  profile: PerfilCompleto;
  onAddSkill: () => void;
  onEditSkill: (skill: Skill) => void;
  onDeleteSkill: (id: string) => void;
}

const getSkillLevelProgress = (level: string): number => {
  const normalized = level.trim().toLowerCase();
  if (normalized === "basico" || normalized === "básico") return 33;
  if (normalized === "intermedio") return 66;
  return 100;
};

export function ProfileSkillsTab({ profile, onAddSkill, onEditSkill, onDeleteSkill }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Habilidades</h3>
        <Button size="sm" onClick={onAddSkill}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Habilidad
        </Button>
      </div>

      {profile.habilidades && profile.habilidades.length > 0 ? (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Habilidades Técnicas</h4>
            <div className="grid gap-3">
              {profile.habilidades
                .filter((skill) => skill.tipo === "tecnica")
                .map((skill, index) => (
                  <div key={skill.id || `${skill.nombre}-${index}`} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{skill.nombre}</span>
                        <span className="text-xs text-slate-500">({skill.nivel})</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-blue-600"
                          onClick={() => onEditSkill(skill)}
                          aria-label="Editar habilidad"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-red-600"
                          onClick={() => skill.id && onDeleteSkill(skill.id)}
                          aria-label="Eliminar habilidad"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <progress
                      className="h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-blue-600"
                      max={100}
                      value={getSkillLevelProgress(skill.nivel)}
                      aria-label={`Nivel de ${skill.nombre}`}
                    />
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Habilidades Blandas</h4>
            <div className="flex flex-wrap gap-2">
              {profile.habilidades
                .filter((skill) => skill.tipo === "blanda")
                .map((skill, index) => (
                  <div
                    key={skill.id || `${skill.nombre}-${index}`}
                    className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-full text-sm"
                  >
                    <Star className="w-4 h-4" />
                    <span>{skill.nombre}</span>
                    <button
                      type="button"
                      className="ml-1 text-green-600 hover:text-green-800"
                      onClick={() => skill.id && onDeleteSkill(skill.id)}
                      aria-label="Eliminar habilidad"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Award className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">No has agregado habilidades aún</p>
          <Button size="sm" onClick={onAddSkill}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar tu primera habilidad
          </Button>
        </div>
      )}
    </div>
  );
}
