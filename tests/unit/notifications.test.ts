import { describe, expect, it } from "bun:test";

import { MailMessage } from "../../app/Support/Mail";
import {
  NotificationDispatcher,
  broadcastRouteFor,
  mailRouteFor,
  type Notification,
} from "../../app/Support/Notifications";

describe("notification route helpers", () => {
  it("resolves mail and broadcast routes", () => {
    expect(mailRouteFor({ email: "user@example.test" })).toBe("user@example.test");
    expect(broadcastRouteFor({ id: 7 })).toBe("notifiable.7");
  });
});

describe("NotificationDispatcher", () => {
  it("sends mail and broadcast notifications", async () => {
    const mails: unknown[] = [];
    const broadcasts: unknown[] = [];
    const dispatcher = new NotificationDispatcher(
      {
        send: async (message: unknown) => mails.push(message),
      } as any,
      {
        broadcast: async (event: unknown) => {
          broadcasts.push(event);

          return event;
        },
      } as any,
      {} as any,
      {
        queueByDefault: false,
      }
    );
    const notification: Notification = {
      via: () => ["mail", "broadcast"],
      toMail: () => new MailMessage().subject("Test").line("Body"),
      toBroadcast: () => ({
        data: {
          ok: true,
        },
        event: "NotificationSent",
      }),
    };

    await dispatcher.send(
      {
        email: "user@example.test",
        id: 7,
      },
      notification
    );

    expect(mails).toHaveLength(1);
    expect(broadcasts).toEqual([
      {
        channel: "notifiable.7",
        data: {
          ok: true,
        },
        event: "NotificationSent",
      },
    ]);
  });

  it("queues queueable notifications", async () => {
    const queued: unknown[] = [];
    const dispatcher = new NotificationDispatcher(
      {} as any,
      {} as any,
      {
        push: async (job: unknown) => {
          queued.push(job);

          return job;
        },
      } as any,
      {
        queueByDefault: false,
      }
    );

    await dispatcher.send(
      {
        email: "user@example.test",
      },
      {
        shouldQueue: true,
        via: () => [],
      }
    );

    expect(queued).toHaveLength(1);
  });
});
