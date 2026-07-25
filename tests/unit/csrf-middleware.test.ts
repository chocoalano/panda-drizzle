import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import {
  CsrfMiddleware,
  csrfTokensMatch,
  hasBearerAuthorization,
  parseCookieHeader,
} from "../../app/Http/Middlewares/CsrfMiddleware";

describe("parseCookieHeader", () => {
  it("parses cookie header pairs", () => {
    expect(parseCookieHeader("csrf-token=abc; theme=dark")).toEqual(
      new Map([
        ["csrf-token", "abc"],
        ["theme", "dark"],
      ])
    );
    expect(parseCookieHeader("csrf-token=%E0%A4%A")).toEqual(
      new Map([["csrf-token", "%E0%A4%A"]])
    );
  });
});

describe("csrf helpers", () => {
  it("matches double-submit CSRF tokens", () => {
    const request = new Request("http://localhost/form", {
      headers: {
        cookie: "csrf-token=abc",
        "x-csrf-token": "abc",
      },
    });

    expect(
      csrfTokensMatch(request, {
        cookieName: "csrf-token",
        headerName: "x-csrf-token",
      })
    ).toBe(true);
    expect(hasBearerAuthorization(request)).toBe(false);
  });
});

describe("CsrfMiddleware", () => {
  it("rejects unsafe cookie requests without a matching CSRF token", async () => {
    const app = new CsrfMiddleware({
      cookieName: "csrf-token",
      enabled: true,
      headerName: "x-csrf-token",
      methods: ["POST"],
    })
      .handle(new Elysia())
      .post("/form", () => ({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/form", {
        method: "POST",
        headers: {
          cookie: "csrf-token=abc",
        },
      })
    );

    expect(response.status).toBe(419);
    await expect(response.json()).resolves.toEqual({
      message: "CSRF token mismatch.",
    });
  });
});
