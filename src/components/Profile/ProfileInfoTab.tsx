import React from "react";
import { Mail, Globe, MapPin, Briefcase, BookOpen, Calendar, Linkedin, Github, Twitter, Edit2, User } from "lucide-react";
import { PerfilCompleto } from "@/types/profile";

interface Props {
  profile: PerfilCompleto;
  onEditPersonalInfo: () => void;
}

export function ProfileInfoTab({ profile, onEditPersonalInfo }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Información Personal</h3>
        <button
          type="button"
          onClick={onEditPersonalInfo}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Editar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-sm text-slate-500 font-medium">Correo electrónico</p>
            <p className="text-slate-900">{profile.email}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-sm text-slate-500 font-medium">Nombre completo</p>
            <p className="text-slate-900">{profile.nombre}</p>
          </div>
        </div>

        {profile.telefono && (
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500 font-medium">Teléfono</p>
              <p className="text-slate-900">{profile.telefono}</p>
            </div>
          </div>
        )}

        {profile.ubicacion && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500 font-medium">Ubicación</p>
              <p className="text-slate-900">{profile.ubicacion}</p>
            </div>
          </div>
        )}

        {profile.carrera && (
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500 font-medium">Carrera</p>
              <p className="text-slate-900">{profile.carrera}</p>
            </div>
          </div>
        )}

        {profile.universidad && (
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500 font-medium">Universidad</p>
              <p className="text-slate-900">{profile.universidad}</p>
            </div>
          </div>
        )}

        {profile.fechaGraduacion && (
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500 font-medium">Fecha de Graduación</p>
              <p className="text-slate-900">
                {new Date(profile.fechaGraduacion).toLocaleDateString("es-CO", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        )}

        {profile.nivelIngles && (
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-500 font-medium">Nivel de Inglés</p>
              <p className="text-slate-900">{profile.nivelIngles}</p>
            </div>
          </div>
        )}
      </div>

      {profile.bio && (
        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Descripción</h4>
          <p className="text-slate-700">{profile.bio}</p>
        </div>
      )}

      {profile.redesSociales && (
        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">Redes Sociales</h4>
          <div className="flex gap-4">
            {profile.redesSociales.linkedin && (
              <a href={profile.redesSociales.linkedin} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                <Linkedin className="w-5 h-5" />
                <span className="text-sm">LinkedIn</span>
              </a>
            )}
            {profile.redesSociales.github && (
              <a href={profile.redesSociales.github} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900">
                <Github className="w-5 h-5" />
                <span className="text-sm">GitHub</span>
              </a>
            )}
            {profile.redesSociales.twitter && (
              <a href={profile.redesSociales.twitter} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sky-500 hover:text-sky-600">
                <Twitter className="w-5 h-5" />
                <span className="text-sm">Twitter</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
