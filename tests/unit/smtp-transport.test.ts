import { describe, expect, it } from "bun:test";
import { createServer, type Socket } from "node:net";

import {
  ArrayMailTransport,
  SmtpTransport,
  buildRfc822Message,
  createNodeSmtpConnection,
  normalizeOutgoingMail,
  smtpReplyHasCapability,
  takeSmtpReply,
  type SmtpConnection,
} from "../../app/Support/Mail";
import type { MailConfig } from "../../config/mail";

class FakeSmtpConnection implements SmtpConnection {
  commands: string[] = [];
  dataPayload = "";

  close() {}

  async read() {
    return {
      code: 220,
      message: "ready",
    };
  }

  async command(command: string, expected: number | number[]) {
    this.commands.push(command);
    const code = Array.isArray(expected) ? expected[0] : expected;

    return {
      code,
      message: command === "EHLO localhost" ? "250-smtp.test\n250 STARTTLS" : "ok",
    };
  }

  async data(message: string) {
    this.dataPayload = message;

    return {
      code: 250,
      message: "queued",
    };
  }
}

const config: MailConfig = {
  defaultMailer: "smtp",
  from: {
    address: "from@example.test",
    name: "Framework",
  },
  smtp: {
    allowInsecureAuth: true,
    encryption: "none",
    host: "smtp.test",
    password: "secret",
    port: 2525,
    timeoutMs: 1000,
    username: "user",
  },
};

describe("takeSmtpReply", () => {
  it("terminates on a single-line reply that has no leading newline", () => {
    expect(takeSmtpReply("220 smtp.test ESMTP\r\n")).toEqual({
      reply: "220 smtp.test ESMTP",
      rest: "",
    });
  });

  it("terminates on a bare code with no trailing text", () => {
    expect(takeSmtpReply("250\r\n")).toEqual({
      reply: "250",
      rest: "",
    });
  });

  it("waits for the final line of a multi-line reply", () => {
    expect(takeSmtpReply("250-smtp.test\r\n250-STARTTLS\r\n")).toBeUndefined();
    expect(takeSmtpReply("250-smtp.test\r\n250-STARTTLS\r\n250 OK\r\n")).toEqual({
      reply: "250-smtp.test\r\n250-STARTTLS\r\n250 OK",
      rest: "",
    });
  });

  it("waits for a complete line before terminating", () => {
    expect(takeSmtpReply("220 smtp.test ESMTP")).toBeUndefined();
  });

  it("keeps pipelined replies buffered as the remainder", () => {
    expect(takeSmtpReply("220 ready\r\n250 next\r\n")).toEqual({
      reply: "220 ready",
      rest: "250 next\r\n",
    });
  });
});

describe("createNodeSmtpConnection", () => {
  it("reads single-line replies from a real SMTP server", async () => {
    const server = await startFakeSmtpServer();

    try {
      const connection = await createNodeSmtpConnection({
        ...config.smtp,
        host: "127.0.0.1",
        port: server.port,
      });

      try {
        expect(await connection.read()).toEqual({
          code: 220,
          message: "220 smtp.test ESMTP",
        });
        expect(await connection.command("EHLO localhost", 250)).toEqual({
          code: 250,
          message: "250-smtp.test\n250 STARTTLS",
        });
        expect(await connection.command("QUIT", 221)).toEqual({
          code: 221,
          message: "221 Bye",
        });
      } finally {
        connection.close();
      }
    } finally {
      await server.close();
    }
  });
});

describe("buildRfc822Message", () => {
  it("builds safe RFC 822 messages", () => {
    const message = buildRfc822Message(
      normalizeOutgoingMail(
        {
          subject: "Hello\r\nInjected: no",
          text: "Body",
          to: "to@example.test",
        },
        config.from
      )
    );

    expect(message).toContain("Subject: Hello Injected: no");
    expect(message).toContain("Body");
  });

  it("rejects unsafe custom header names", () => {
    expect(() =>
      buildRfc822Message(
        normalizeOutgoingMail(
          {
            headers: {
              "X-Test\r\nInjected": "bad",
            },
            subject: "Hello",
            text: "Body",
            to: "to@example.test",
          },
          config.from
        )
      )
    ).toThrow("Unsafe mail header name");
  });
});

describe("SmtpTransport", () => {
  it("sends mail through SMTP commands", async () => {
    const connection = new FakeSmtpConnection();
    const transport = new SmtpTransport(config, async () => connection);

    await transport.send({
      subject: "Hello",
      text: "Body",
      to: "to@example.test",
    });

    expect(connection.commands).toContain("EHLO localhost");
    expect(connection.commands.some((command) => command.startsWith("AUTH PLAIN"))).toBe(
      true
    );
    expect(connection.commands).toContain("MAIL FROM:<from@example.test>");
    expect(connection.commands).toContain("RCPT TO:<to@example.test>");
    expect(connection.dataPayload).toContain("Subject: Hello");
  });

  it("requires TLS or explicit opt-in before SMTP AUTH", async () => {
    const connection = new FakeSmtpConnection();
    const transport = new SmtpTransport(
      {
        ...config,
        smtp: {
          ...config.smtp,
          allowInsecureAuth: false,
        },
      },
      async () => connection
    );

    await expect(
      transport.send({
        subject: "Hello",
        text: "Body",
        to: "to@example.test",
      })
    ).rejects.toThrow("insecure connection");
  });

  it("rejects unsafe envelope addresses", async () => {
    const connection = new FakeSmtpConnection();
    const transport = new SmtpTransport(config, async () => connection);

    await expect(
      transport.send({
        subject: "Hello",
        text: "Body",
        to: "to@example.test\r\nRCPT TO:<evil@example.test>",
      })
    ).rejects.toThrow("Unsafe mail address");
  });

  it("detects SMTP capabilities", () => {
    expect(
      smtpReplyHasCapability(
        {
          code: 250,
          message: "250-smtp.test\n250 STARTTLS",
        },
        "STARTTLS"
      )
    ).toBe(true);
  });
});

describe("ArrayMailTransport", () => {
  it("stores messages for tests", async () => {
    const transport = new ArrayMailTransport();

    await transport.send({
      subject: "Stored",
      to: "to@example.test",
    });

    expect(transport.messages).toHaveLength(1);
  });
});

function startFakeSmtpServer() {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding("utf8");
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 smtp.test ESMTP\r\n");

    socket.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
        if (line.startsWith("EHLO")) {
          socket.write("250-smtp.test\r\n250 STARTTLS\r\n");
        } else if (line.startsWith("QUIT")) {
          socket.write("221 Bye\r\n");
        } else {
          socket.write("250 OK\r\n");
        }
      }
    });
  });

  server.unref();

  return new Promise<{ close: () => Promise<void>; port: number }>(
    (resolve, reject) => {
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();

        if (!address || typeof address === "string") {
          reject(new Error("Unable to resolve an available SMTP test port."));

          return;
        }

        resolve({
          close: () =>
            new Promise<void>((done) => {
              for (const socket of sockets) {
                socket.destroy();
              }

              server.close(() => done());
            }),
          port: address.port,
        });
      });
    }
  );
}
