export type NotificationType = "achievement" | "streak" | "tip" | "progress";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
}
