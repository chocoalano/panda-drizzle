import { describe, expect, it } from "bun:test";

import { formatServiceTimestamp } from "../../resources/js/time";

describe("formatServiceTimestamp", () => {
  it("formats service timestamps deterministically for SSR hydration", () => {
    expect(
      formatServiceTimestamp("2026-07-16T00:52:38.000Z", {
        locale: "en",
        timeZone: "UTC",
      })
    ).toBe(
      "Jul 16, 2026 00:52:38 UTC"
    );
  });

  it("formats timestamps with the configured Indonesian locale and UCT alias", () => {
    expect(
      formatServiceTimestamp("2026-07-16T00:52:38.000Z", {
        locale: "id_ID",
        timeZone: "UCT",
      })
    ).toBe("16 Jul 2026 00:52:38 UTC");
  });

  it("formats timestamps in an IANA timezone", () => {
    expect(
      formatServiceTimestamp("2026-07-16T00:52:38.000Z", {
        locale: "id_ID",
        timeZone: "Asia/Jakarta",
      })
    ).toBe("16 Jul 2026 07:52:38 Asia/Jakarta");
  });

  it("handles missing and invalid values", () => {
    expect(formatServiceTimestamp(null)).toBe("Waiting for service");
    expect(formatServiceTimestamp("not-a-date")).toBe(
      "Invalid service timestamp"
    );
  });
});
