import { Experience, Skill, Preferencias, PerfilCompleto } from "./profile";

export type BackendAuthMeResponse = {
  id?: string | number;
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
  picture?: string;
  avatar?: string;
  telefono?: string;
  ubicacion?: string;
  carrera?: string;
  universidad?: string;
  fechaGraduacion?: string;
  fecha_graduacion?: string;
  bio?: string;
  descripcion?: string;
  nivelIngles?: string;
  nivel_ingles?: string;
  experiencias?: Experience[];
  habilidades?: Skill[];
  preferencias?: Preferencias;
  estadisticas?: PerfilCompleto["estadisticas"];
  logros?: PerfilCompleto["logros"];
  redesSociales?: PerfilCompleto["redesSociales"];
  cvUrl?: string;
};

export type BackendProfileResponse = {
  id?: string | number;
  user_id?: string | number;
  full_name?: string;
  career?: string;
  university?: string;
  graduation_date?: string;
  description?: string;
  english_level?: string;
  preferred_location?: string;
  preferred_employment_type?: string;
  salary_expectation?: number | string | null;
};

export type BackendProfilePayload = {
  full_name?: string;
  career?: string;
  university?: string;
  graduation_date?: string;
  description?: string;
  english_level?: string;
  preferred_location?: string;
  preferred_employment_type?: string;
  salary_expectation?: number;
};

export type BackendExperienceResponse = {
  id: number;
  profile_id: number;
  position: string;
  company: string;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
  currently_working: boolean;
  ubicacion?: string | null;
};

export type BackendExperiencePayload = {
  position: string;
  company: string;
  start_date: string;
  end_date?: string | null;
  description?: string;
  currently_working: boolean;
  ubicacion?: string;
};

export type BackendSkillResponse = {
  id: number;
  profile_id: number;
  name: string;
  category?: string | null;
  level?: string | null;
};

export type BackendSkillPayload = {
  name: string;
  category?: string;
  level?: string;
};
