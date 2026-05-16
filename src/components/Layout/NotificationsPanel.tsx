import React from "react";
import { Trophy, Flame, Lightbulb, TrendingUp, BellOff } from "lucide-react";
import { AppNotification, NotificationType } from "@/types/notifications";

interface NotificationsPanelProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; bg: string; iconColor: string }> = {
  achievement: { icon: Trophy,     bg: "bg-yellow-50",  iconColor: "text-yellow-500" },
  streak:      { icon: Flame,      bg: "bg-orange-50",  iconColor: "text-orange-500" },
  tip:         { icon: Lightbulb,  bg: "bg-blue-50",    iconColor: "text-blue-500"   },
  progress:    { icon: TrendingUp, bg: "bg-green-50",   iconColor: "text-green-500"  },
};

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: AppNotification;
  onMarkAsRead: (id: string) => void;
}) {
  const { icon: Icon, bg, iconColor } = TYPE_CONFIG[notification.type];

  return (
    <div
      className={`flex gap-3 px-4 py-3 transition-colors ${
        notification.read ? "bg-white" : "bg-blue-50/40"
      }`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-snug ${notification.read ? "text-slate-600" : "text-slate-900"}`}>
            {notification.title}
          </p>
          {!notification.read && (
            <button
              type="button"
              onClick={() => onMarkAsRead(notification.id)}
              className="shrink-0 rounded-full w-2 h-2 mt-1.5 bg-blue-500 hover:bg-blue-700 transition-colors"
              aria-label="Marcar como leída"
              title="Marcar como leída"
            />
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 leading-snug">{notification.message}</p>
      </div>
    </div>
  );
}

export function NotificationsPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationsPanelProps) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
            {unread > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white leading-none">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Marcar todo leído
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
              <BellOff className="h-8 w-8" />
              <p className="text-sm">Sin notificaciones por ahora</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkAsRead={onMarkAsRead} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
