import { describe, expect, it } from "bun:test";

import {
  HttpError,
  InvalidJsonRequestError,
  isHttpError,
} from "../../app/Support/HttpError";

describe("HttpError", () => {
  it("marks renderable HTTP errors with a status code", () => {
    const error = new HttpError("Bad request.", 400);

    expect(isHttpError(error)).toBe(true);
    expect(isHttpError(new Error("boom"))).toBe(false);
  });

  it("provides an invalid JSON request error", () => {
    const error = new InvalidJsonRequestError();

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid JSON request body.");
  });
});
