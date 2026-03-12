import { PerfilCompleto } from "@/types/profile";

export const ONBOARDING_SKIP_KEY_PREFIX = "profile_onboarding_skipped_";

export const getOnboardingSkipKey = (profileId: string) =>
  `${ONBOARDING_SKIP_KEY_PREFIX}${profileId}`;

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