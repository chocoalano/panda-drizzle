import { envBoolean } from "./env";

export const notificationConfig = {
  queueByDefault: envBoolean("NOTIFICATIONS_QUEUE", false),
};

export type NotificationConfig = typeof notificationConfig;
