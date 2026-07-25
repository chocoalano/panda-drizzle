import { env, envBoolean } from "./env";
import { positiveInteger } from "./request";

export type MailerName = "array" | "log" | "smtp";
export type SmtpEncryption = "none" | "starttls" | "tls";

export const mailConfig = {
  defaultMailer: normalizeMailer(env("MAIL_MAILER", "smtp")),
  from: {
    address: env("MAIL_FROM_ADDRESS", "hello@example.test"),
    name: env("MAIL_FROM_NAME", "Patshop On-Demand"),
  },
  smtp: {
    allowInsecureAuth: envBoolean("MAIL_ALLOW_INSECURE_AUTH", false),
    encryption: normalizeSmtpEncryption(env("MAIL_ENCRYPTION", "starttls")),
    host: env("MAIL_HOST", "127.0.0.1"),
    password: env("MAIL_PASSWORD"),
    port: positiveInteger(env("MAIL_PORT"), 587),
    timeoutMs: positiveInteger(env("MAIL_TIMEOUT_MS"), 10_000),
    username: env("MAIL_USERNAME"),
  },
};

export type MailConfig = typeof mailConfig;

export function normalizeMailer(
  value: string | undefined,
  fallback: MailerName = "smtp"
): MailerName {
  const normalized = value?.trim().toLowerCase();

  return normalized === "smtp" || normalized === "log" || normalized === "array"
    ? normalized
    : fallback;
}

export function normalizeSmtpEncryption(
  value: string | undefined,
  fallback: SmtpEncryption = "starttls"
): SmtpEncryption {
  const normalized = value?.trim().toLowerCase();

  return normalized === "tls" || normalized === "starttls" || normalized === "none"
    ? normalized
    : fallback;
}
