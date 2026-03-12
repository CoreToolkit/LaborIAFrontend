// Tipos para el perfil completo del usuario

export interface Experience {
  id?: string;
  cargo: string;
  empresa: string;
  fechaInicio: string;
  fechaFin: string | null; // null si es trabajo actual
  descripcion?: string;
  esActual: boolean;
  ubicacion?: string;
}

export interface Skill {
  id?: string;
  nombre: string;
  tipo: 'tecnica' | 'blanda';
  nivel: 'Basico' | 'Intermedio' | 'Avanzado';
  descripcion?: string;
}

export interface Preferencias {
  cargo?: string;
  industria?: string;
  ubicacion?: string;
  salarioEsperado?: number;
  tipoContrato?: string;
  disponibilidadInmediata?: boolean;
}

export interface Estadisticas {
  entrevistasRealizadas: number;
  nivelPromedio: number; // 0-100
  rachaActual: number; // días
  tiempoTotalMinutos: number;
  ultimaPractica?: string; // ISO date
  progresoSemanal?: {
    fecha: string;
    puntuacion: number;
  }[];
  skillsMasEstudiadas?: string[];
}

export interface Logro {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  desbloqueado: boolean;
  fechaDesbloqueo?: string;
  progresoActual: number;
  progresoRequerido: number;
}

export interface RedesSociales {
  linkedin?: string;
  github?: string;
  twitter?: string;
}

export interface PerfilCompleto {
  // Información básica
  id: string;
  email: string;
  nombre: string;
  fotoPerfil?: string;
  
  // Información adicional
  telefono?: string;
  ubicacion?: string;
  carrera?: string;
  universidad?: string;
  fechaGraduacion?: string;
  bio?: string;
  nivelIngles?: string;
  
  // Secciones completas
  experiencias: Experience[];
  habilidades: Skill[];
  preferencias?: Preferencias;
  estadisticas?: Estadisticas;
  logros: Logro[];
  redesSociales?: RedesSociales;
  cvUrl?: string;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}
