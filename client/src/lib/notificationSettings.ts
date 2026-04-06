export type AppNotificationSettings = {
  enabled: boolean;
  messenger: boolean;
  approval: boolean;
  notice: boolean;
  schedule: boolean;
  sound: boolean;
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
};

export const APP_NOTIFICATION_SETTINGS_KEY = "app-notification-settings";

export const DEFAULT_APP_NOTIFICATION_SETTINGS: AppNotificationSettings = {
  enabled: true,
  messenger: true,
  approval: true,
  notice: true,
  schedule: true,
  sound: true,
  dndEnabled: false,
  dndStart: "22:00",
  dndEnd: "08:00",
};

export function readAppNotificationSettings(): AppNotificationSettings {
  try {
    const raw = localStorage.getItem(APP_NOTIFICATION_SETTINGS_KEY);
    if (!raw) return DEFAULT_APP_NOTIFICATION_SETTINGS;

    const parsed = JSON.parse(raw);

    return {
      enabled:
        typeof parsed?.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_APP_NOTIFICATION_SETTINGS.enabled,
      messenger:
        typeof parsed?.messenger === "boolean"
          ? parsed.messenger
          : DEFAULT_APP_NOTIFICATION_SETTINGS.messenger,
      approval:
        typeof parsed?.approval === "boolean"
          ? parsed.approval
          : DEFAULT_APP_NOTIFICATION_SETTINGS.approval,
      notice:
        typeof parsed?.notice === "boolean"
          ? parsed.notice
          : DEFAULT_APP_NOTIFICATION_SETTINGS.notice,
      schedule:
        typeof parsed?.schedule === "boolean"
          ? parsed.schedule
          : DEFAULT_APP_NOTIFICATION_SETTINGS.schedule,
      sound:
        typeof parsed?.sound === "boolean"
          ? parsed.sound
          : DEFAULT_APP_NOTIFICATION_SETTINGS.sound,
      dndEnabled:
        typeof parsed?.dndEnabled === "boolean"
          ? parsed.dndEnabled
          : DEFAULT_APP_NOTIFICATION_SETTINGS.dndEnabled,
      dndStart:
        typeof parsed?.dndStart === "string" && parsed.dndStart
          ? parsed.dndStart
          : DEFAULT_APP_NOTIFICATION_SETTINGS.dndStart,
      dndEnd:
        typeof parsed?.dndEnd === "string" && parsed.dndEnd
          ? parsed.dndEnd
          : DEFAULT_APP_NOTIFICATION_SETTINGS.dndEnd,
    };
  } catch {
    return DEFAULT_APP_NOTIFICATION_SETTINGS;
  }
}

export function saveAppNotificationSettings(
  next: AppNotificationSettings
): void {
  localStorage.setItem(APP_NOTIFICATION_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("app:notification-settings-changed"));
}

export function updateAppNotificationSettings(
  partial: Partial<AppNotificationSettings>
): AppNotificationSettings {
  const current = readAppNotificationSettings();
  const next = {
    ...current,
    ...partial,
  };
  saveAppNotificationSettings(next);
  return next;
}

export function isNowInDndRange(start: string, end: string) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const current = `${hh}:${mm}`;

  if (start === end) return true;
  if (start < end) return current >= start && current <= end;
  return current >= start || current <= end;
}