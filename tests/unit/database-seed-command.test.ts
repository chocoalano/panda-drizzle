import { describe, expect, it } from "bun:test";

import {
  DatabaseSeedCommand,
  formatDatabaseSeederResult,
  parseSeederTarget,
} from "../../app/Console/Commands/DatabaseSeedCommand";
import type {
  DatabaseSeederResult,
  SeederRunResult,
} from "../../app/Support/Seeders/runner";

function assertDatabaseSeederResult(
  result: SeederRunResult
): asserts result is DatabaseSeederResult {
  if (!("systemSettings" in result)) {
    throw new Error("Expected a database seeder result.");
  }
}

describe("DatabaseSeedCommand", () => {
  it("formats database seeder output", () => {
    expect(
      formatDatabaseSeederResult({
        faker: {
          seed: 7,
          locale: "en",
          refDate: "2026-01-01T00:00:00.000Z",
        },
        systemSettings: 2,
      })
    ).toEqual([
      "Seeded 2 system setting record(s).",
      "Faker seed 7 (en, 2026-01-01T00:00:00.000Z).",
    ]);
  });

  it("formats targeted seeder output", () => {
    expect(
      formatDatabaseSeederResult({
        faker: {
          seed: 7,
          locale: "en",
          refDate: "2026-01-01T00:00:00.000Z",
        },
        result: 3,
        seeder: "UserSeeder",
      })
    ).toEqual([
      "Seeded UserSeeder.",
      "Seeder result: 3.",
      "Faker seed 7 (en, 2026-01-01T00:00:00.000Z).",
    ]);
  });

  it("runs seeders and writes each output line", async () => {
    const output: string[] = [];
    const command = new DatabaseSeedCommand(async () => ({
      faker: {
        seed: 11,
        locale: "id_ID",
        refDate: "2026-02-03T04:05:06.000Z",
      },
      systemSettings: 2,
    }));

    const result = await command.handle((message) => output.push(message));

    assertDatabaseSeederResult(result);
    expect(result.systemSettings).toBe(2);
    expect(output).toEqual([
      "Seeded 2 system setting record(s).",
      "Faker seed 11 (id_ID, 2026-02-03T04:05:06.000Z).",
    ]);
  });

  it("passes target seeder arguments to the runner", async () => {
    const calls: unknown[] = [];
    const command = new DatabaseSeedCommand(async (options) => {
      calls.push(options);

      return {
        faker: {
          seed: 11,
          locale: "id_ID",
          refDate: "2026-02-03T04:05:06.000Z",
        },
        result: 1,
        seeder: "SystemSettingsSeeder",
      };
    });

    await command.handle(() => {}, console.error, {
      args: ["--class=SystemSettingsSeeder"],
      cwd: "/tmp/project",
    });

    expect(calls).toEqual([
      {
        cwd: "/tmp/project",
        target: "SystemSettingsSeeder",
      },
    ]);
  });

  it("refuses production seeders without force", async () => {
    const command = new DatabaseSeedCommand(
      async () => ({
        faker: {
          seed: 11,
          locale: "id_ID",
          refDate: "2026-02-03T04:05:06.000Z",
        },
        systemSettings: 2,
      }),
      "production"
    );

    await expect(command.handle(console.log)).rejects.toThrow("without --force");
  });
});

describe("parseSeederTarget", () => {
  it("parses Laravel-style seeder target options", () => {
    expect(parseSeederTarget(["--class=UserSeeder"])).toBe("UserSeeder");
    expect(parseSeederTarget(["--file", "UserSeeder"])).toBe("UserSeeder");
    expect(parseSeederTarget(["SystemSettingsSeeder"])).toBe(
      "SystemSettingsSeeder"
    );
    expect(parseSeederTarget(["--force"])).toBeUndefined();
  });
});
