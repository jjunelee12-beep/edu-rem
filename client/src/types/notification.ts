export type AppNotificationCategory =
  | "messenger"
  | "approval"
  | "notice"
  | "schedule"
  | "attendance"
  | "payment"
  | "refund"
  | "system";

export type AppNotificationLevel =
  | "normal"
  | "important"
  | "urgent"
  | "success"
  | "danger";

export type AppNotificationActionKind =
  | "route"
  | "messenger-room"
  | "approval-detail"
  | "notice-detail"
  | "schedule-detail"
  | "custom";

export type AppNotificationAction = {
  kind: AppNotificationActionKind;
  payload?: Record<string, any>;
};

export type AppNotification = {
  id: string;
  category: AppNotificationCategory;
  level?: AppNotificationLevel;
  title: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
  read?: boolean;
  durationMs?: number;
  action?: AppNotificationAction;
};

export type AppToastEventDetail = AppNotification;

export type AppNotificationClickEventDetail = {
  notification: AppNotification;
};