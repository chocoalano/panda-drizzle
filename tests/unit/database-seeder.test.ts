import { describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveDatabaseConfig } from "../../config/database";
import type { Database } from "../../config/Database/client";
import { seederConfig } from "../../config/seeder";
import type { SeederRunOptions } from "../../app/Support/Seeders/Seeder";
import { DatabaseSeeder } from "../../database/seeders/DatabaseSeeder";
import { createSeederContext } from "../../app/Support/Seeders/faker";
import {
  normalizeSeederTarget,
  runSeeders,
} from "../../app/Support/Seeders/runner";

describe("DatabaseSeeder", () => {
  it("runs application seeders with the shared context and connection", async () => {
    const context = createSeederContext({
      seed: 11,
      refDate: "2026-03-04T05:06:07.000Z",
      locale: "en",
    });
    const db = { name: "fake-db" };
    const calls: unknown[] = [];
    const seeder = new DatabaseSeeder({
      async run(receivedDb: Database, options: SeederRunOptions = {}) {
        calls.push({ db: receivedDb, options });

        return 2;
      },
    });

    const result = await seeder.run(db as any, {
      connection: "sqlite",
      context,
    });

    expect(calls).toEqual([
      {
        db,
        options: {
          connection: "sqlite",
          context,
        },
      },
    ]);
    expect(result).toEqual({
      faker: {
        seed: 11,
        locale: "en",
        refDate: "2026-03-04T05:06:07.000Z",
      },
      systemSettings: 2,
    });
  });
});

describe("runSeeders", () => {
  it("uses an injected database and root seeder when provided", async () => {
    const db = { name: "fake-db" };
    const config = resolveDatabaseConfig({
      connection: "sqlite",
      database: ":memory:",
    });
    const seeder = {
      async run(receivedDb: unknown, options: unknown) {
        return {
          db: receivedDb,
          options,
          faker: {
            seed: 1,
            locale: "en",
            refDate: "2026-01-01T00:00:00.000Z",
          },
          systemSettings: 2,
        };
      },
    };

    const result = await runSeeders({
      config,
      db: db as any,
      seeder: seeder as any,
    });

    expect(result).toMatchObject({
      db,
      options: {
        connection: "sqlite",
      },
      systemSettings: 2,
    });
  });

  it("runs a targeted seeder file by class name", async () => {
    const cwd = await mkdtemp();
    const db = { name: "fake-db" };
    const allowTargetSeeders = seederConfig.allowTargetSeeders;

    seederConfig.allowTargetSeeders = true;

    try {
      await mkdir(join(cwd, "database/seeders"), { recursive: true });
      await Bun.write(
        join(cwd, "database/seeders/UserSeeder.ts"),
        [
          "export class UserSeeder {",
          "  async run(db, options) {",
          "    return `${db.name}:${options.connection}:${options.context.seed}`;",
          "  }",
          "}",
          "",
        ].join("\n")
      );

      const result = await runSeeders({
        config: resolveDatabaseConfig({
          connection: "sqlite",
          database: ":memory:",
        }),
        context: createSeederContext({
          seed: 99,
          locale: "en",
          refDate: "2026-01-01T00:00:00.000Z",
        }),
        cwd,
        db: db as any,
        target: "UserSeeder",
      });

      expect(result).toEqual({
        faker: {
          seed: 99,
          locale: "en",
          refDate: "2026-01-01T00:00:00.000Z",
        },
        result: "fake-db:sqlite:99",
        seeder: "UserSeeder",
      });
    } finally {
      seederConfig.allowTargetSeeders = allowTargetSeeders;
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });

  it("rejects targeted seeders when dynamic imports are disabled", async () => {
    const allowTargetSeeders = seederConfig.allowTargetSeeders;

    seederConfig.allowTargetSeeders = false;

    try {
      await expect(
        runSeeders({
          db: {} as any,
          target: "UserSeeder",
        })
      ).rejects.toThrow("Targeted seeders are disabled");
    } finally {
      seederConfig.allowTargetSeeders = allowTargetSeeders;
    }
  });
});

describe("normalizeSeederTarget", () => {
  it("normalizes safe seeder targets", () => {
    expect(normalizeSeederTarget("database/seeders/user-seeder.ts")).toEqual({
      className: "UserSeeder",
      filePath: "user-seeder.ts",
    });
  });

  it("rejects traversal targets", () => {
    expect(() => normalizeSeederTarget("../UserSeeder")).toThrow(
      "database/seeders"
    );
  });
});

async function mkdtemp() {
  const directory = join(tmpdir(), `patshop-seeder-${crypto.randomUUID()}`);

  await mkdir(directory, { recursive: true });

  return directory;
}
