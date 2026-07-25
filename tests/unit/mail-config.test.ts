import { describe, expect, it } from "bun:test";

import {
  mailConfig,
  normalizeMailer,
  normalizeSmtpEncryption,
} from "../../config/mail";

describe("mailConfig", () => {
  it("normalizes mailers and SMTP encryption", () => {
    expect(normalizeMailer("array")).toBe("array");
    expect(normalizeMailer("smtp")).toBe("smtp");
    expect(normalizeMailer("bad")).toBe("smtp");
    expect(normalizeSmtpEncryption("tls")).toBe("tls");
    expect(normalizeSmtpEncryption("none")).toBe("none");
    expect(normalizeSmtpEncryption("bad")).toBe("starttls");
    expect(mailConfig.from.address).toBeTruthy();
    expect(mailConfig.smtp.allowInsecureAuth).toBe(false);
  });
});
