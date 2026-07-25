import { describe, expect, it } from "bun:test";

import {
  isSensitiveQueryParam,
  redactUrlSearch,
  safeRequestUrl,
} from "../../config/sanitization";

describe("query sanitization", () => {
  it("detects sensitive query parameters case-insensitively", () => {
    expect(isSensitiveQueryParam("Token")).toBe(true);
    expect(isSensitiveQueryParam("page")).toBe(false);
  });

  it("redacts sensitive query values", () => {
    expect(redactUrlSearch("?token=abc&page=1&X-Amz-Signature=sig")).toBe(
      "?token=%5BRedacted%5D&page=1&X-Amz-Signature=%5BRedacted%5D"
    );
  });

  it("builds a safe request URL payload", () => {
    expect(safeRequestUrl("http://localhost/reset?code=secret&page=1")).toEqual({
      path: "/reset",
      query: "?code=%5BRedacted%5D&page=1",
      url: "/reset?code=%5BRedacted%5D&page=1",
    });
  });
});
