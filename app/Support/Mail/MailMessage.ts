export type MailAddress = string | {
  address: string;
  name?: string;
};

export type OutgoingMail = {
  from?: MailAddress;
  headers?: Record<string, string>;
  html?: string;
  subject: string;
  text?: string;
  to: MailAddress | MailAddress[];
};

export class MailMessage {
  private readonly lines: string[] = [];
  private actionLabel?: string;
  private actionUrl?: string;
  private greetingLine = "Hello,";
  private mailSubject = "Notification";

  subject(value: string) {
    this.mailSubject = value;

    return this;
  }

  greeting(value: string) {
    this.greetingLine = value;

    return this;
  }

  line(value: string) {
    this.lines.push(value);

    return this;
  }

  action(label: string, url: string) {
    this.actionLabel = label;
    this.actionUrl = url;

    return this;
  }

  render(to: MailAddress, from?: MailAddress): OutgoingMail {
    return {
      from,
      subject: this.mailSubject,
      text: this.renderText(),
      to,
    };
  }

  renderText() {
    const body = [this.greetingLine, "", ...this.lines];

    if (this.actionLabel && this.actionUrl) {
      body.push("", `${this.actionLabel}: ${this.actionUrl}`);
    }

    return body.join("\n");
  }
}

export function formatMailAddress(address: MailAddress) {
  if (typeof address === "string") {
    return address;
  }

  return address.name ? `${address.name} <${address.address}>` : address.address;
}

export function mailAddressValue(address: MailAddress) {
  return typeof address === "string" ? address : address.address;
}
