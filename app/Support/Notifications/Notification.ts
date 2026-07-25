import type { BroadcastEvent } from "../Broadcasting";
import type { MailAddress } from "../Mail";
import type { MailMessage } from "../Mail/MailMessage";

export type NotificationChannel = "broadcast" | "mail";

export type Notifiable = {
  broadcastChannel?: string;
  email?: string;
  id?: number | string;
  routeNotificationForBroadcast?: () => string;
  routeNotificationForMail?: () => MailAddress | undefined;
};

export type Notification = {
  shouldQueue?: boolean;
  toBroadcast?: (notifiable: Notifiable) => BroadcastEvent;
  toMail?: (notifiable: Notifiable) => MailMessage;
  via(notifiable: Notifiable): NotificationChannel[];
};

export function mailRouteFor(notifiable: Notifiable) {
  return notifiable.routeNotificationForMail?.() ?? notifiable.email;
}

export function broadcastRouteFor(notifiable: Notifiable) {
  return (
    notifiable.routeNotificationForBroadcast?.() ??
    notifiable.broadcastChannel ??
    (notifiable.id === undefined ? undefined : `notifiable.${notifiable.id}`)
  );
}
