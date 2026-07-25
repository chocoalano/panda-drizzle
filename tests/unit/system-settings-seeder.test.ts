import { describe, expect, it } from "bun:test";

import { createSeederContext } from "../../app/Support/Seeders/faker";
import { buildSystemSettingSeeds } from "../../database/seeders/SystemSettingsSeeder";

describe("buildSystemSettingSeeds", () => {
  it("builds deterministic system setting seed data", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const seeds = buildSystemSettingSeeds(now);

    expect(seeds).toEqual([
      {
        key: "app.name",
        value: "patshop-ondemand-webapp",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "app.env",
        value: "local",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("uses Faker seeder context dates for deterministic seed timestamps", () => {
    const context = createSeederContext({
      seed: 99,
      refDate: "2026-02-03T04:05:06.000Z",
    });
    const seeds = buildSystemSettingSeeds(context.now);

    expect(seeds[0]?.createdAt.toISOString()).toBe("2026-02-03T04:05:06.000Z");
    expect(seeds[1]?.updatedAt.toISOString()).toBe("2026-02-03T04:05:06.000Z");
  });
});
