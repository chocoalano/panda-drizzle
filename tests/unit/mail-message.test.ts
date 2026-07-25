import { describe, expect, it } from "bun:test";

import {
  MailMessage,
  formatMailAddress,
  mailAddressValue,
} from "../../app/Support/Mail";

describe("MailMessage", () => {
  it("renders a Laravel-style text mail message", () => {
    const message = new MailMessage()
      .subject("Welcome")
      .greeting("Hi,")
      .line("Your account is ready.")
      .action("Open dashboard", "https://app.test");

    expect(message.renderText()).toContain("Open dashboard: https://app.test");
    expect(message.render("user@example.test")).toMatchObject({
      subject: "Welcome",
      to: "user@example.test",
    });
  });
});

describe("mail address helpers", () => {
  it("formats mail addresses", () => {
    expect(
      formatMailAddress({
        address: "user@example.test",
        name: "User",
      })
    ).toBe("User <user@example.test>");
    expect(mailAddressValue("user@example.test")).toBe("user@example.test");
  });
});
