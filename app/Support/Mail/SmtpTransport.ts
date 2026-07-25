import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";

import { mailConfig, type MailConfig } from "../../../config/mail";
import {
  formatMailAddress,
  mailAddressValue,
  type MailAddress,
  type OutgoingMail,
} from "./MailMessage";

export interface MailTransport {
  send(message: OutgoingMail): Promise<void>;
}

export type SmtpReply = {
  code: number;
  message: string;
};

export interface SmtpConnection {
  close(): void;
  command(command: string, expected: number | number[]): Promise<SmtpReply>;
  data(message: string): Promise<SmtpReply>;
  read(): Promise<SmtpReply>;
  upgradeToTls?(host: string): Promise<SmtpConnection>;
}

export type SmtpConnector = (
  config: MailConfig["smtp"]
) => Promise<SmtpConnection>;

export class SmtpTransport implements MailTransport {
  constructor(
    private readonly config: MailConfig = mailConfig,
    private readonly connector: SmtpConnector = createNodeSmtpConnection
  ) {}

  async send(message: OutgoingMail) {
    const envelope = normalizeOutgoingMail(message, this.config.from);
    let connection = await this.connector(this.config.smtp);
    let secured = this.config.smtp.encryption === "tls";

    try {
      expectReply(await connection.read(), 220);
      let ehlo = await connection.command("EHLO localhost", 250);

      if (this.config.smtp.encryption === "starttls") {
        if (!connection.upgradeToTls) {
          throw new Error("SMTP connection does not support STARTTLS upgrade.");
        }

        if (!smtpReplyHasCapability(ehlo, "STARTTLS")) {
          throw new Error("SMTP server does not advertise STARTTLS.");
        }

        await connection.command("STARTTLS", 220);
        connection = await connection.upgradeToTls(this.config.smtp.host);
        secured = true;
        await connection.command("EHLO localhost", 250);
      }

      if (this.config.smtp.username) {
        if (!secured && !this.config.smtp.allowInsecureAuth) {
          throw new Error(
            "Refusing SMTP AUTH over an insecure connection. Set MAIL_ALLOW_INSECURE_AUTH=true to allow it."
          );
        }

        const credentials = Buffer.from(
          `\0${this.config.smtp.username}\0${this.config.smtp.password}`
        ).toString("base64");

        await connection.command(`AUTH PLAIN ${credentials}`, 235);
      }

      await connection.command(`MAIL FROM:<${safeMailAddress(envelope.from)}>`, 250);

      for (const recipient of envelope.to) {
        await connection.command(`RCPT TO:<${safeMailAddress(recipient)}>`, [
          250,
          251,
        ]);
      }

      await connection.command("DATA", 354);
      await connection.data(buildRfc822Message(envelope));
      await connection.command("QUIT", 221);
    } finally {
      connection.close();
    }
  }
}

export class LogMailTransport implements MailTransport {
  constructor(private readonly logger: (message: string) => void = console.log) {}

  async send(message: OutgoingMail) {
    this.logger(buildRfc822Message(normalizeOutgoingMail(message, mailConfig.from)));
  }
}

export class ArrayMailTransport implements MailTransport {
  readonly messages: OutgoingMail[] = [];

  async send(message: OutgoingMail) {
    this.messages.push(message);
  }
}

export function normalizeOutgoingMail(
  message: OutgoingMail,
  defaultFrom: MailAddress
) {
  return {
    ...message,
    from: message.from ?? defaultFrom,
    to: Array.isArray(message.to) ? message.to : [message.to],
  };
}

export function buildRfc822Message(
  message: OutgoingMail & { from: MailAddress; to: MailAddress[] }
) {
  const headers = {
    From: formatMailAddress(message.from),
    To: message.to.map(formatMailAddress).join(", "),
    Subject: message.subject,
    "MIME-Version": "1.0",
    "Content-Type": message.html
      ? "text/html; charset=utf-8"
      : "text/plain; charset=utf-8",
    ...(message.headers ?? {}),
  };
  const body = message.html ?? message.text ?? "";

  return `${Object.entries(headers)
    .map(([key, value]) => `${sanitizeHeaderName(key)}: ${sanitizeHeader(String(value))}`)
    .join("\r\n")}\r\n\r\n${body.replace(/\r?\n/g, "\r\n")}\r\n`;
}

export async function createNodeSmtpConnection(config: MailConfig["smtp"]) {
  const socket =
    config.encryption === "tls"
      ? tlsConnect({
          host: config.host,
          port: config.port,
          servername: config.host,
          timeout: config.timeoutMs,
        })
      : netConnect({
          host: config.host,
          port: config.port,
          timeout: config.timeoutMs,
        });

  return new NodeSmtpConnection(socket, config.timeoutMs);
}

class NodeSmtpConnection implements SmtpConnection {
  private buffer = "";
  private failure?: Error;
  private ended = false;
  private notify = () => {};

  private readonly onData = (chunk: Buffer | string) => {
    this.buffer += String(chunk);
    this.notify();
  };

  private readonly onError = (error: Error) => {
    this.failure = error;
    this.notify();
  };

  private readonly onClose = () => {
    this.ended = true;
    this.notify();
  };

  private readonly onTimeout = () => {
    this.failure = new Error("SMTP connection timed out.");
    this.socket.destroy();
    this.notify();
  };

  constructor(
    private readonly socket: Socket | TLSSocket,
    private readonly timeoutMs = 10_000
  ) {
    this.socket.setEncoding("utf8");
    this.socket.setTimeout(this.timeoutMs);
    this.socket.on("data", this.onData);
    this.socket.on("error", this.onError);
    this.socket.on("close", this.onClose);
    this.socket.on("end", this.onClose);
    this.socket.on("timeout", this.onTimeout);
  }

  close() {
    this.detach();
    this.socket.end();
  }

  async read() {
    return parseSmtpReply(await this.readRawReply());
  }

  async command(command: string, expected: number | number[]) {
    this.socket.write(`${command}\r\n`);

    return expectReply(await this.read(), expected);
  }

  async data(message: string) {
    this.socket.write(`${escapeSmtpData(message)}\r\n.\r\n`);

    return expectReply(await this.read(), 250);
  }

  async upgradeToTls(host: string) {
    const pending = this.buffer;

    if (pending.trim()) {
      throw new Error("Unexpected SMTP data received before the TLS handshake.");
    }

    this.detach();
    this.socket.setEncoding(null as unknown as BufferEncoding);

    return new NodeSmtpConnection(
      tlsConnect({
        servername: host,
        socket: this.socket,
      }),
      this.timeoutMs
    );
  }

  private detach() {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    this.socket.off("close", this.onClose);
    this.socket.off("end", this.onClose);
    this.socket.off("timeout", this.onTimeout);
  }

  private async readRawReply() {
    while (true) {
      const taken = takeSmtpReply(this.buffer);

      if (taken) {
        this.buffer = taken.rest;

        return taken.reply;
      }

      if (this.failure) {
        throw this.failure;
      }

      if (this.ended) {
        throw new Error("SMTP connection closed before a complete reply.");
      }

      await new Promise<void>((resolve) => {
        this.notify = () => {
          this.notify = () => {};
          resolve();
        };
      });
    }
  }
}

/**
 * A reply ends at the first *complete* line whose 3-digit code is followed by a
 * space or end-of-line; `250-` marks a continuation. The line needs no leading
 * newline, so single-line replies such as `220 smtp.test ESMTP` terminate here.
 */
export function takeSmtpReply(buffer: string) {
  const newline = /\r?\n/g;
  let lineStart = 0;
  let match: RegExpExecArray | null;

  while ((match = newline.exec(buffer)) !== null) {
    const line = buffer.slice(lineStart, match.index);

    if (/^\d{3}(?: |$)/.test(line)) {
      return {
        reply: buffer.slice(0, match.index),
        rest: buffer.slice(match.index + match[0].length),
      };
    }

    lineStart = match.index + match[0].length;
  }

  return undefined;
}

function parseSmtpReply(reply: string): SmtpReply {
  const lines = reply.split(/\r?\n/).filter(Boolean);
  const lastLine = lines.at(-1) ?? "000 Unknown SMTP reply";
  const code = Number(lastLine.slice(0, 3));

  return {
    code,
    message: lines.join("\n"),
  };
}

function expectReply(reply: SmtpReply, expected: number | number[]) {
  const expectedCodes = Array.isArray(expected) ? expected : [expected];

  if (!expectedCodes.includes(reply.code)) {
    throw new Error(`Unexpected SMTP reply ${reply.code}: ${reply.message}`);
  }

  return reply;
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ");
}

function sanitizeHeaderName(value: string) {
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error(`Unsafe mail header name: ${value}`);
  }

  return value;
}

function safeMailAddress(address: MailAddress) {
  const value = mailAddressValue(address).trim();

  if (!value || /[\r\n<>]/.test(value)) {
    throw new Error("Unsafe mail address.");
  }

  return value;
}

export function smtpReplyHasCapability(reply: SmtpReply, capability: string) {
  const expected = capability.trim().toUpperCase();

  return reply.message
    .split(/\r?\n/)
    .some((line) => line.slice(4).trim().split(/\s+/)[0]?.toUpperCase() === expected);
}

function escapeSmtpData(value: string) {
  return value.replace(/^\./gm, "..");
}
