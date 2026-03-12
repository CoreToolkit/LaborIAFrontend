import { PerfilCompleto } from "@/types/profile";

export const ONBOARDING_SKIP_KEY_PREFIX = "profile_onboarding_skipped_";

export const getOnboardingSkipKey = (profileId: string) =>
  `${ONBOARDING_SKIP_KEY_PREFIX}${profileId}`;

export const hasSkippedOnboarding = (profileId: string): boolean => {
  if (typeof window === "undefined") return false;

  return localStorage.getItem(getOnboardingSkipKey(profileId)) === "1";
};

export const markOnboardingSkipped = (profileId: string) => {
  if (typeof window === "undefined") return;

  localStorage.setItem(getOnboardingSkipKey(profileId), "1");
};

export const clearOnboardingSkipped = (profileId: string) => {
  if (typeof window === "undefined") return;

  localStorage.removeItem(getOnboardingSkipKey(profileId));
};

export const profileNeedsOnboarding = (profile: PerfilCompleto | null): boolean => {
  if (!profile) return false;

  const hasEssentialInfo = Boolean(
    profile.carrera?.trim() ||
      profile.universidad?.trim() ||
      profile.telefono?.trim() ||
      profile.ubicacion?.trim() ||
      profile.bio?.trim() ||
      profile.fechaGraduacion ||
      profile.nivelIngles
  );

  const hasProfileActivity =
    profile.experiencias.length > 0 ||
    profile.habilidades.length > 0 ||
    Boolean(profile.preferencias);

  return !hasEssentialInfo && !hasProfileActivity;
};