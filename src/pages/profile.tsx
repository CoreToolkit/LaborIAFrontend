import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { 
  User, Mail, Globe, LogOut, RefreshCw, AlertCircle, Briefcase, 
  Award, Target, TrendingUp, Settings, Linkedin, Github, Twitter,
  Calendar, MapPin, Building, Plus, Edit2, Trash2, Star, Trophy, BookOpen
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Experience, Skill } from "@/types/profile";
import { EditPersonalInfoModal } from "@/components/EditPersonalInfoModal";
import { ExperienceModal } from "@/components/ExperienceModal";
import { SkillModal } from "@/components/SkillModal";
import { PreferencesModal } from "@/components/PreferencesModal";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const { 
    profile, 
    isLoading, 
    error, 
    refetch, 
    updateProfile, 
    addExperience, 
    updateExperience, 
    deleteExperience,
    addSkill,
    updateSkill,
    deleteSkill,
    updatePreferencias 
  } = useProfile();
  const [imageError, setImageError] = React.useState(false);
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'info' | 'experience' | 'skills' | 'stats' | 'preferences'>('info');
  
  // Modal states
  const [isPersonalInfoModalOpen, setIsPersonalInfoModalOpen] = React.useState(false);
  const [isExperienceModalOpen, setIsExperienceModalOpen] = React.useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = React.useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = React.useState(false);
  const [selectedExperience, setSelectedExperience] = React.useState<Experience | undefined>();
  const [selectedSkill, setSelectedSkill] = React.useState<Skill | undefined>();
  const [experienceMode, setExperienceMode] = React.useState<'add' | 'edit'>('add');
  const [skillMode, setSkillMode] = React.useState<'add' | 'edit'>('add');

  // Redirigir si no está autenticado
  React.useEffect(() => {
    if (!sessionLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, sessionLoading, router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      router.push("/login");
    }
  };

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  // Obtener iniciales del nombre para el avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  // Actualizar imagen cuando cambia el perfil
  React.useEffect(() => {
    if (profile) {
      setImageError(false);
      setImageSrc(profile.fotoPerfil || null);
    }
  }, [profile]);

  // Manejar error de imagen y mostrar iniciales
  const handleImageError = () => {
    setImageError(true);
  };

  // Modal handlers
  const handleEditPersonalInfo = () => {
    setIsPersonalInfoModalOpen(true);
  };

  const handleSavePersonalInfo = async (data: { nombre: string; email: string; telefono?: string; ubicacion?: string }) => {
    await updateProfile(data);
  };

  const handleAddExperience = () => {
    setSelectedExperience(undefined);
    setExperienceMode('add');
    setIsExperienceModalOpen(true);
  };

  const handleEditExperience = (experience: Experience) => {
    setSelectedExperience(experience);
    setExperienceMode('edit');
    setIsExperienceModalOpen(true);
  };

  const handleSaveExperience = async (data: Experience) => {
    if (experienceMode === 'add') {
      await addExperience(data);
    } else if (selectedExperience && 'id' in selectedExperience) {
      await updateExperience((selectedExperience as any).id, data);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta experiencia?')) {
      await deleteExperience(id);
    }
  };

  const handleAddSkill = () => {
    setSelectedSkill(undefined);
    setSkillMode('add');
    setIsSkillModalOpen(true);
  };

  const handleEditSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setSkillMode('edit');
    setIsSkillModalOpen(true);
  };

  const handleSaveSkill = async (data: Skill) => {
    if (skillMode === 'add') {
      await addSkill(data);
    } else if (selectedSkill && 'id' in selectedSkill) {
      await updateSkill((selectedSkill as any).id, data);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta habilidad?')) {
      await deleteSkill(id);
    }
  };

  const handleEditPreferences = () => {
    setIsPreferencesModalOpen(true);
  };

  const handleSavePreferences = async (data: any) => {
    await updatePreferencias(data);
  };

  // Mostrar loading durante la verificación de sesión
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // No mostrar nada si no está autenticado (se redirigirá)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Mi Perfil - LaborIA</title>
        <meta name="description" content="Perfil de usuario de LaborIA" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold">LaborIA</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToDashboard}
                >
                  Volver al Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="text-gray-600 mt-2">
              Información de tu cuenta y configuración personal
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <p className="text-gray-600">Cargando datos del perfil...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-red-300 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    Error al cargar el perfil
                  </h3>
                  <p className="text-red-700 mb-4">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refetch}
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reintentar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Profile Data */}
          {profile && !isLoading && !error && (
            <div className="space-y-6">
              {/* Profile Header Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Header Section with Avatar */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {imageSrc && !imageError ? (
                        <img
                          src={imageSrc}
                          alt={profile.nombre}
                          className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                          onError={handleImageError}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border-4 border-white shadow-lg">
                          <span className="text-2xl font-bold text-blue-600">
                            {getInitials(profile.nombre)}
                          </span>
                        </div>
                      )}
                      <div className="text-white">
                        <h2 className="text-2xl font-bold">{profile.nombre}</h2>
                        <p className="text-blue-100 text-sm mt-1">{profile.email}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-white text-blue-600 hover:bg-blue-50"
                      onClick={handleEditPersonalInfo}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar Perfil
                    </Button>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="border-b border-gray-200">
                  <nav className="flex gap-8 px-6" aria-label="Profile sections">
                    <button
                      onClick={() => setActiveTab('info')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'info'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <User className="w-4 h-4 inline mr-2" />
                      Información Personal
                    </button>
                    <button
                      onClick={() => setActiveTab('experience')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'experience'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Briefcase className="w-4 h-4 inline mr-2" />
                      Experiencia
                    </button>
                    <button
                      onClick={() => setActiveTab('skills')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'skills'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Award className="w-4 h-4 inline mr-2" />
                      Habilidades
                    </button>
                    <button
                      onClick={() => setActiveTab('stats')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'stats'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 inline mr-2" />
                      Estadísticas
                    </button>
                    <button
                      onClick={() => setActiveTab('preferences')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'preferences'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Target className="w-4 h-4 inline mr-2" />
                      Preferencias
                    </button>
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="px-6 py-6">
                  {/* Personal Information Tab */}
                  {activeTab === 'info' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Información Personal</h3>
                        <button
                          onClick={() => setIsPersonalInfoModalOpen(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="flex items-start gap-3">
                          <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500 font-medium">Correo electrónico</p>
                            <p className="text-gray-900">{profile.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500 font-medium">Nombre completo</p>
                            <p className="text-gray-900">{profile.nombre}</p>
                          </div>
                        </div>

                        {profile.telefono && (
                          <div className="flex items-start gap-3">
                            <Globe className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Teléfono</p>
                              <p className="text-gray-900">{profile.telefono}</p>
                            </div>
                          </div>
                        )}

                        {profile.ubicacion && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Ubicación</p>
                              <p className="text-gray-900">{profile.ubicacion}</p>
                            </div>
                          </div>
                        )}

                        {profile.carrera && (
                          <div className="flex items-start gap-3">
                            <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Carrera</p>
                              <p className="text-gray-900">{profile.carrera}</p>
                            </div>
                          </div>
                        )}

                        {profile.universidad && (
                          <div className="flex items-start gap-3">
                            <BookOpen className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Universidad</p>
                              <p className="text-gray-900">{profile.universidad}</p>
                            </div>
                          </div>
                        )}

                        {profile.fechaGraduacion && (
                          <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Fecha de Graduación</p>
                              <p className="text-gray-900">
                                {new Date(profile.fechaGraduacion).toLocaleDateString('es-CO', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        )}

                        {profile.nivelIngles && (
                          <div className="flex items-start gap-3">
                            <Globe className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Nivel de Inglés</p>
                              <p className="text-gray-900">{profile.nivelIngles}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bio / Description */}
                      {profile.bio && (
                        <div className="pt-6 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Descripción</h4>
                          <p className="text-gray-700">{profile.bio}</p>
                        </div>
                      )}

                      {/* Social Links */}
                      {profile.redesSociales && (
                        <div className="pt-6 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-4">Redes Sociales</h4>
                          <div className="flex gap-4">
                            {profile.redesSociales.linkedin && (
                              <a
                                href={profile.redesSociales.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                              >
                                <Linkedin className="w-5 h-5" />
                                <span className="text-sm">LinkedIn</span>
                              </a>
                            )}
                            {profile.redesSociales.github && (
                              <a
                                href={profile.redesSociales.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                              >
                                <Github className="w-5 h-5" />
                                <span className="text-sm">GitHub</span>
                              </a>
                            )}
                            {profile.redesSociales.twitter && (
                              <a
                                href={profile.redesSociales.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sky-500 hover:text-sky-600"
                              >
                                <Twitter className="w-5 h-5" />
                                <span className="text-sm">Twitter</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Experience Tab */}
                  {activeTab === 'experience' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Experiencia Laboral</h3>
                        <Button size="sm" onClick={handleAddExperience}>
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar Experiencia
                        </Button>
                      </div>
                      
                      {profile.experiencias && profile.experiencias.length > 0 ? (
                        <div className="space-y-4">
                          {profile.experiencias.map((exp, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                              <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                  <div className="p-2 bg-blue-50 rounded-lg">
                                    <Building className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900">{exp.cargo}</h4>
                                    <p className="text-gray-600">{exp.empresa}</p>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {exp.fechaInicio} - {exp.esActual ? 'Presente' : exp.fechaFin}
                                      </span>
                                      {exp.ubicacion && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-4 h-4" />
                                          {exp.ubicacion}
                                        </span>
                                      )}
                                    </div>
                                    {exp.descripcion && (
                                      <p className="text-gray-700 mt-2 text-sm">{exp.descripcion}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    className="p-1 text-gray-400 hover:text-blue-600"
                                    onClick={() => handleEditExperience(exp)}
                                    aria-label="Editar experiencia"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    className="p-1 text-gray-400 hover:text-red-600"
                                    onClick={() => 'id' in exp && handleDeleteExperience((exp as any).id)}
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
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-4">No has agregado experiencia laboral aún</p>
                          <Button size="sm" onClick={handleAddExperience}>
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar tu primera experiencia
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Skills Tab */}
                  {activeTab === 'skills' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Habilidades</h3>
                        <Button size="sm" onClick={handleAddSkill}>
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar Habilidad
                        </Button>
                      </div>
                      
                      {profile.habilidades && profile.habilidades.length > 0 ? (
                        <div className="space-y-6">
                          {/* Technical Skills */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Habilidades Técnicas</h4>
                            <div className="grid gap-3">
                              {profile.habilidades
                                .filter(skill => skill.tipo === 'tecnica')
                                .map((skill, index) => (
                                  <div key={index} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{skill.nombre}</span>
                                        <span className="text-xs text-gray-500">({skill.nivel})</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <button 
                                          className="p-1 text-gray-400 hover:text-blue-600"
                                          onClick={() => handleEditSkill(skill)}
                                          aria-label="Editar habilidad"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button 
                                          className="p-1 text-gray-400 hover:text-red-600"
                                          onClick={() => 'id' in skill && handleDeleteSkill((skill as any).id)}
                                          aria-label="Eliminar habilidad"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ 
                                          width: `${
                                            skill.nivel === 'Basico' ? '33%' :
                                            skill.nivel === 'Intermedio' ? '66%' :
                                            '100%'
                                          }` 
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Soft Skills */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Habilidades Blandas</h4>
                            <div className="flex flex-wrap gap-2">
                              {profile.habilidades
                                .filter(skill => skill.tipo === 'blanda')
                                .map((skill, index) => (
                                  <div key={index} className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-full text-sm">
                                    <Star className="w-4 h-4" />
                                    <span>{skill.nombre}</span>
                                    <button 
                                      className="ml-1 text-green-600 hover:text-green-800"
                                      onClick={() => 'id' in skill && handleDeleteSkill((skill as any).id)}
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
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <Award className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-4">No has agregado habilidades aún</p>
                          <Button size="sm" onClick={handleAddSkill}>
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar tu primera habilidad
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Statistics Tab */}
                  {activeTab === 'stats' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900">Estadísticas de Entrenamiento</h3>
                      
                      {profile.estadisticas ? (
                        <div className="space-y-6">
                          {/* Key Metrics */}
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

                          {/* Achievements */}
                          {profile.logros && profile.logros.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Logros Desbloqueados</h4>
                              <div className="grid grid-cols-3 gap-4">
                                {profile.logros.map((logro, index) => (
                                  <div 
                                    key={index} 
                                    className={`p-4 rounded-lg border-2 ${
                                      logro.desbloqueado 
                                        ? 'bg-yellow-50 border-yellow-400' 
                                        : 'bg-gray-50 border-gray-200 opacity-60'
                                    }`}
                                  >
                                    <div className="text-center">
                                      <div className="text-3xl mb-2">{logro.icono}</div>
                                      <h5 className="font-semibold text-gray-900 text-sm">{logro.nombre}</h5>
                                      <p className="text-xs text-gray-600 mt-1">{logro.descripcion}</p>
                                      {logro.desbloqueado && logro.fechaDesbloqueo && (
                                        <p className="text-xs text-gray-500 mt-2">
                                          Desbloqueado: {new Date(logro.fechaDesbloqueo).toLocaleDateString()}
                                        </p>
                                      )}
                                      {!logro.desbloqueado && (
                                        <div className="mt-2">
                                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div 
                                              className="bg-blue-600 h-1.5 rounded-full"
                                              style={{ width: `${(logro.progresoActual / logro.progresoRequerido) * 100}%` }}
                                            />
                                          </div>
                                          <p className="text-xs text-gray-600 mt-1">
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
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-4">Aún no tienes estadísticas disponibles</p>
                          <p className="text-gray-500 text-sm">Comienza a practicar entrevistas para ver tu progreso</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preferences Tab */}
                  {activeTab === 'preferences' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Preferencias Laborales</h3>
                        <Button size="sm" onClick={handleEditPreferences}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Editar Preferencias
                        </Button>
                      </div>
                      
                      {profile.preferencias ? (
                        <div className="grid grid-cols-2 gap-6">
                          {profile.preferencias.cargo && (
                            <div>
                              <p className="text-sm text-gray-500 font-medium mb-2">Cargo Deseado</p>
                              <p className="text-gray-900">{profile.preferencias.cargo}</p>
                            </div>
                          )}

                          {profile.preferencias.industria && (
                            <div>
                              <p className="text-sm text-gray-500 font-medium mb-2">Industria</p>
                              <p className="text-gray-900">{profile.preferencias.industria}</p>
                            </div>
                          )}

                          {profile.preferencias.ubicacion && (
                            <div>
                              <p className="text-sm text-gray-500 font-medium mb-2">Ubicación Preferida</p>
                              <p className="text-gray-900">{profile.preferencias.ubicacion}</p>
                            </div>
                          )}

                          {profile.preferencias.salarioEsperado && (
                            <div>
                              <p className="text-sm text-gray-500 font-medium mb-2">Salario Esperado</p>
                              <p className="text-gray-900">${profile.preferencias.salarioEsperado.toLocaleString()}</p>
                            </div>
                          )}

                          {profile.preferencias.tipoContrato && (
                            <div>
                              <p className="text-sm text-gray-500 font-medium mb-2">Tipo de Contrato</p>
                              <p className="text-gray-900">{profile.preferencias.tipoContrato}</p>
                            </div>
                          )}

                          {typeof profile.preferencias.disponibilidadInmediata === 'boolean' && (
                            <div>
                              <p className="text-sm text-gray-500 font-medium mb-2">Disponibilidad</p>
                              <p className="text-gray-900">
                                {profile.preferencias.disponibilidadInmediata ? 'Inmediata' : 'A convenir'}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-4">No has configurado tus preferencias laborales</p>
                          <Button size="sm" onClick={handleEditPreferences}>
                            <Settings className="w-4 h-4 mr-2" />
                            Configurar Preferencias
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Acciones
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar Perfil
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Configuración
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Modals */}
        {profile && (
          <>
            <EditPersonalInfoModal
              isOpen={isPersonalInfoModalOpen}
              onClose={() => setIsPersonalInfoModalOpen(false)}
              initialData={{
                nombre: profile.nombre,
                email: profile.email,
                telefono: profile.telefono,
                ubicacion: profile.ubicacion,
                carrera: profile.carrera,
                universidad: profile.universidad,
                fechaGraduacion: profile.fechaGraduacion,
                bio: profile.bio,
                nivelIngles: profile.nivelIngles,
              }}
              onSave={handleSavePersonalInfo}
            />
            
            <ExperienceModal
              isOpen={isExperienceModalOpen}
              onClose={() => setIsExperienceModalOpen(false)}
              initialData={selectedExperience}
              onSave={handleSaveExperience}
              mode={experienceMode}
            />
            
            <SkillModal
              isOpen={isSkillModalOpen}
              onClose={() => setIsSkillModalOpen(false)}
              initialData={selectedSkill}
              onSave={handleSaveSkill}
              mode={skillMode}
            />
            
            {(
              <PreferencesModal
                isOpen={isPreferencesModalOpen}
                onClose={() => setIsPreferencesModalOpen(false)}
                initialData={profile.preferencias || {
                  cargo: '',
                  industria: '',
                  ubicacion: '',
                  salarioEsperado: 0,
                  tipoContrato: '',
                  disponibilidadInmediata: false,
                }}
                onSave={handleSavePreferences}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
