import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { HttpError } from "../../app/Support/HttpError";
import { AuthorizationError } from "../../app/Support/Policy";
import type { FrameworkLogger } from "../../app/Support/Logging";
import {
  exceptionMessage,
  renderException,
  validationIssuesFrom,
} from "../../bootstrap/exceptions";

describe("renderException", () => {
  it("renders not found errors", () => {
    expect(
      renderException("NOT_FOUND", new Error("missing"), {
        logger: makeLogger(),
      })
    ).toEqual({
      status: 404,
      body: {
        message: "Route not found",
      },
    });
  });

  it("renders authorization errors", () => {
    expect(
      renderException("UNKNOWN", new AuthorizationError("Forbidden action."), {
        logger: makeLogger(),
      })
    ).toEqual({
      status: 403,
      body: {
        message: "Forbidden action.",
      },
    });
  });

  it("renders HTTP errors", () => {
    expect(
      renderException("UNKNOWN", new HttpError("Invalid request.", 400), {
        logger: makeLogger(),
      })
    ).toEqual({
      status: 400,
      body: {
        message: "Invalid request.",
      },
    });
  });

  it("renders Zod validation errors as 422 instead of 500", () => {
    const schema = z.object({
      name: z.string().min(1),
      tags: z.array(z.string()),
    });
    const error = schema.safeParse({ name: "", tags: [1] }).error;

    expect(
      renderException("UNKNOWN", error, {
        logger: makeLogger(),
      })
    ).toEqual({
      status: 422,
      body: {
        message: "The given data was invalid.",
        errors: [
          {
            field: "name",
            message: expect.any(String),
          },
          {
            field: "tags[0]",
            message: expect.any(String),
          },
        ],
      },
    });
  });

  it("renders Elysia VALIDATION errors as 422 with readable fields", () => {
    const error = Object.assign(new Error("{...raw json dump...}"), {
      status: 422,
      all: [
        {
          path: "/email",
          message: "Expected string",
          summary: "Property 'email' should be string",
        },
      ],
    });

    expect(
      renderException("VALIDATION", error, {
        logger: makeLogger(),
      })
    ).toEqual({
      status: 422,
      body: {
        message: "The given data was invalid.",
        errors: [
          {
            field: "email",
            message: "Property 'email' should be string",
          },
        ],
      },
    });
  });

  it("renders VALIDATION errors without detail as a generic 422", () => {
    expect(
      renderException("VALIDATION", new Error("bad"), {
        logger: makeLogger(),
      })
    ).toEqual({
      status: 422,
      body: {
        message: "The given data was invalid.",
        errors: [
          {
            field: "",
            message: "Request validation failed.",
          },
        ],
      },
    });
  });

  it("renders generic errors", () => {
    expect(
      renderException("UNKNOWN", new Error("boom"), {
        logger: makeLogger(),
      })
    ).toEqual({
      status: 500,
      body: {
        message: "Internal server error",
        error: "boom",
      },
    });
  });

  it("logs every rendered framework error through the injected logger", () => {
    const entries: Array<{
      message?: string;
      payload: Record<string, unknown>;
    }> = [];
    const request = new Request("http://localhost/users?page=1", {
      method: "POST",
    });

    renderException("UNKNOWN", new Error("boom"), {
      logger: makeLogger(entries),
      request,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe("Framework error detected.");
    expect(entries[0]?.payload).toMatchObject({
      code: "UNKNOWN",
      event: "framework.error",
      request: {
        method: "POST",
        path: "/users",
        query: "?page=1",
        url: "/users?page=1",
      },
      status: 500,
    });
    expect(entries[0]?.payload.err).toMatchObject({
      message: "boom",
      type: "Error",
    });
  });
});

describe("validationIssuesFrom", () => {
  it("ignores non-validation errors", () => {
    expect(validationIssuesFrom("UNKNOWN", new Error("boom"))).toBeUndefined();
    expect(
      validationIssuesFrom("UNKNOWN", new HttpError("nope", 400))
    ).toBeUndefined();
  });

  it("flattens nested Zod paths into dotted field names", () => {
    const error = z
      .object({ user: z.object({ email: z.string() }) })
      .safeParse({ user: {} }).error;

    expect(validationIssuesFrom("UNKNOWN", error)).toEqual([
      {
        field: "user.email",
        message: expect.any(String),
      },
    ]);
  });
});

describe("exceptionMessage", () => {
  it("normalizes non-error exceptions", () => {
    expect(exceptionMessage("boom")).toBe("Unknown error");
  });
});

function makeLogger(
  entries: Array<{
    message?: string;
    payload: Record<string, unknown>;
  }> = []
): FrameworkLogger {
  return {
    error(payload, message) {
      entries.push({
        message,
        payload: payload as Record<string, unknown>,
      });
    },
    flush() {},
  };
}
