import { useCallback, useEffect, useMemo, useState } from "react";
import { PerfilCompleto } from "@/types/profile";
import { AppNotification } from "@/types/notifications";

const STORAGE_KEY = "laboria_read_notifications";

const getReadIds = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
};

const saveReadIds = (ids: Set<string>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
};

function buildNotifications(profile: PerfilCompleto): Omit<AppNotification, "read">[] {
  const items: Omit<AppNotification, "read">[] = [];

  // Logros desbloqueados
  for (const logro of profile.logros) {
    if (logro.desbloqueado) {
      items.push({
        id: `achievement-${logro.id}`,
        type: "achievement",
        title: "¡Logro desbloqueado!",
        message: `Conseguiste "${logro.nombre}": ${logro.descripcion}`,
      });
    }
  }

  // Racha en riesgo
  if (profile.estadisticas?.ultimaPractica) {
    const daysSince = Math.floor(
      (Date.now() - new Date(profile.estadisticas.ultimaPractica).getTime()) / 86_400_000
    );
    if (daysSince >= 2) {
      items.push({
        id: `streak-risk-${daysSince}`,
        type: "streak",
        title: "Racha en riesgo",
        message: `Llevas ${daysSince} día${daysSince !== 1 ? "s" : ""} sin practicar. ¡No pierdas tu racha!`,
      });
    }
  }

  // Sin entrevistas aún
  if (!profile.estadisticas || profile.estadisticas.entrevistasRealizadas === 0) {
    items.push({
      id: "tip-start",
      type: "tip",
      title: "Empieza a practicar",
      message: "Realiza tu primera entrevista simulada para comenzar a ver tu progreso.",
    });
  }

  // Habilidad en nivel básico
  const basicSkill = profile.habilidades.find((s) => s.nivel === "Basico");
  if (basicSkill) {
    items.push({
      id: `tip-skill-${basicSkill.nombre.toLowerCase().replace(/\s+/g, "-")}`,
      type: "tip",
      title: "Tip de mejora",
      message: `Tu habilidad "${basicSkill.nombre}" está en nivel básico. Practica entrevistas para subirla.`,
    });
  }

  // Perfil incompleto
  if (!profile.bio || !profile.universidad) {
    const missing: string[] = [];
    if (!profile.bio) missing.push("descripción");
    if (!profile.universidad) missing.push("universidad");
    items.push({
      id: "tip-profile-incomplete",
      type: "tip",
      title: "Completa tu perfil",
      message: `Añade tu ${missing.join(" y ")} para mejorar tus coincidencias de roles.`,
    });
  }

  // Buen progreso
  if (profile.estadisticas && profile.estadisticas.nivelPromedio >= 70) {
    items.push({
      id: `progress-good-${Math.floor(profile.estadisticas.nivelPromedio)}`,
      type: "progress",
      title: "¡Vas muy bien!",
      message: `Tu nivel promedio es ${profile.estadisticas.nivelPromedio}%. Sigue así.`,
    });
  }

  return items;
}

export interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export function useNotifications(profile: PerfilCompleto | null): UseNotificationsResult {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setReadIds(getReadIds());
  }, []);

  const raw = useMemo(
    () => (profile ? buildNotifications(profile) : []),
    [profile]
  );

  const notifications = useMemo<AppNotification[]>(
    () => raw.map((n) => ({ ...n, read: readIds.has(n.id) })),
    [raw, readIds]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      raw.forEach((n) => next.add(n.id));
      saveReadIds(next);
      return next;
    });
  }, [raw]);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
