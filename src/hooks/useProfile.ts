import { useProfileFetch } from "./useProfileFetch";
import { useExperienceManager } from "./useExperienceManager";
import { useSkillManager } from "./useSkillManager";
import { PerfilCompleto, Experience, Skill, Preferencias } from "@/types/profile";

interface UseProfileResult {
  profile: PerfilCompleto | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateProfile: (data: Partial<PerfilCompleto>) => Promise<void>;
  addExperience: (experience: Experience) => Promise<void>;
  updateExperience: (id: string, experience: Experience) => Promise<void>;
  deleteExperience: (id: string) => Promise<void>;
  addSkill: (skill: Skill) => Promise<void>;
  updateSkill: (id: string, skill: Skill) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  updatePreferencias: (preferencias: Preferencias) => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const {
    profile,
    isLoading,
    error,
    refetch,
    updateProfile,
    updatePreferencias,
    setProfile,
    handleUnauthenticated,
  } = useProfileFetch();

  const { addExperience, updateExperience, deleteExperience } = useExperienceManager(
    setProfile,
    handleUnauthenticated
  );

  const { addSkill, updateSkill, deleteSkill } = useSkillManager(
    setProfile,
    handleUnauthenticated
  );

  return {
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
    updatePreferencias,
  };
}
