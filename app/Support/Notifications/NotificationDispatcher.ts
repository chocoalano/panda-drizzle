import {
  notificationConfig,
  type NotificationConfig,
} from "../../../config/notifications";
import type { BroadcastManager } from "../Broadcasting";
import { broadcaster } from "../Broadcasting";
import type { MailManager } from "../Mail";
import { mail } from "../Mail";
import type { QueueManager } from "../Queue";
import { queue } from "../Queue";
import {
  broadcastRouteFor,
  mailRouteFor,
  type Notifiable,
  type Notification,
} from "./Notification";

export class NotificationDispatcher {
  constructor(
    private readonly mailer: MailManager = mail,
    private readonly broadcastManager: BroadcastManager = broadcaster,
    private readonly queueManager: QueueManager = queue,
    private readonly config: NotificationConfig = notificationConfig
  ) {}

  async send(
    notifiables: Notifiable | Notifiable[],
    notification: Notification
  ) {
    const recipients = Array.isArray(notifiables) ? notifiables : [notifiables];

    if (notification.shouldQueue ?? this.config.queueByDefault) {
      return this.queueManager.push({
        name: notification.constructor.name || "SendNotification",
        handle: () => this.sendNow(recipients, notification),
      });
    }

    return this.sendNow(recipients, notification);
  }

  async sendNow(notifiables: Notifiable[], notification: Notification) {
    for (const notifiable of notifiables) {
      for (const channel of notification.via(notifiable)) {
        if (channel === "mail") {
          await this.sendMail(notifiable, notification);
        }

        if (channel === "broadcast") {
          await this.sendBroadcast(notifiable, notification);
        }
      }
    }
  }

  private async sendMail(notifiable: Notifiable, notification: Notification) {
    const route = mailRouteFor(notifiable);

    if (!route || !notification.toMail) {
      return;
    }

    await this.mailer.send(notification.toMail(notifiable).render(route));
  }

  private async sendBroadcast(notifiable: Notifiable, notification: Notification) {
    const channel = broadcastRouteFor(notifiable);

    if (!channel || !notification.toBroadcast) {
      return;
    }

    const event = notification.toBroadcast(notifiable);

    await this.broadcastManager.broadcast({
      ...event,
      channel: event.channel || channel,
    });
  }
}

export const notifications = new NotificationDispatcher();

export function notify(
  notifiables: Notifiable | Notifiable[],
  notification: Notification
) {
  return notifications.send(notifiables, notification);
}
