import { mailConfig, type MailConfig, type MailerName } from "../../../config/mail";
import { ArrayMailTransport, LogMailTransport, SmtpTransport, type MailTransport } from "./SmtpTransport";
import type { OutgoingMail } from "./MailMessage";

export class MailManager {
  private readonly resolvedMailers = new Map<MailerName, MailTransport>();

  constructor(private readonly config: MailConfig = mailConfig) {}

  mailer(name: MailerName = this.config.defaultMailer) {
    if (!this.resolvedMailers.has(name)) {
      this.resolvedMailers.set(name, this.makeMailer(name));
    }

    return this.resolvedMailers.get(name) as MailTransport;
  }

  send(message: OutgoingMail, mailer?: MailerName) {
    return this.mailer(mailer).send(message);
  }

  private makeMailer(name: MailerName): MailTransport {
    if (name === "array") {
      return new ArrayMailTransport();
    }

    if (name === "log") {
      return new LogMailTransport();
    }

    return new SmtpTransport(this.config);
  }
}

export const mail = new MailManager();
