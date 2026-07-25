import { describe, expect, it } from "bun:test";

import {
  createSeederContext,
  makeSeederRecords,
  resolveSeederFakerConfig,
  summarizeSeederContext,
} from "../../app/Support/Seeders/faker";

describe("seeder Faker support", () => {
  it("resolves deterministic Faker config from explicit options", () => {
    const config = resolveSeederFakerConfig({
      seed: "42",
      refDate: "2026-01-02T03:04:05.000Z",
      locale: "id-ID",
    });

    expect(config.seed).toBe(42);
    expect(config.locale).toBe("id_ID");
    expect(config.refDate.toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  it("creates repeatable Faker values for the same seed", () => {
    const first = createSeederContext({
      seed: 123,
      refDate: "2026-01-01T00:00:00.000Z",
      locale: "en",
    });
    const second = createSeederContext({
      seed: 123,
      refDate: "2026-01-01T00:00:00.000Z",
      locale: "en",
    });

    expect(first.faker.internet.email()).toBe(second.faker.internet.email());
    expect(first.faker.date.soon().toISOString()).toBe(
      second.faker.date.soon().toISOString()
    );
  });

  it("builds a fixed number of Faker-backed seeder records", () => {
    const context = createSeederContext({ seed: 7, locale: "en" });
    const records = makeSeederRecords(
      ({ faker }, index) => ({
        index,
        email: faker.internet.email(),
      }),
      2,
      context
    );

    expect(records).toHaveLength(2);
    expect(records[0]?.index).toBe(0);
    expect(records[0]?.email).toContain("@");
    expect(records[1]?.index).toBe(1);
  });

  it("summarizes the active Faker context for seeder output", () => {
    const context = createSeederContext({
      seed: 1,
      refDate: "2026-05-06T00:00:00.000Z",
      locale: "id_ID",
    });

    expect(summarizeSeederContext(context)).toEqual({
      seed: 1,
      locale: "id_ID",
      refDate: "2026-05-06T00:00:00.000Z",
    });
  });

  it("rejects invalid Faker seeder values", () => {
    expect(() => resolveSeederFakerConfig({ seed: "abc" })).toThrow(
      "Invalid SEEDER_FAKER_SEED"
    );
    expect(() => resolveSeederFakerConfig({ locale: "missing" })).toThrow(
      "Unsupported seeder Faker locale"
    );
    expect(() => makeSeederRecords(() => ({}), -1)).toThrow(
      "Seeder record count"
    );
  });
});
