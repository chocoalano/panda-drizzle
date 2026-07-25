import { eq } from "drizzle-orm";

import { appConfig } from "../../config/app";
import { databaseConfig, type DatabaseConnection } from "../../config/database";
import type { Database } from "../../config/Database/client";
import { getSystemSettingsTable } from "../../config/Database/schema";
import {
  createSeederContext,
  type SeederContext,
} from "../../app/Support/Seeders/faker";
import type {
  Seeder,
  SeederRunOptions,
} from "../../app/Support/Seeders/Seeder";

export type SystemSettingSeed = {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
};

export function buildSystemSettingSeeds(now = new Date()): SystemSettingSeed[] {
  return [
    {
      key: "app.name",
      value: appConfig.name,
      createdAt: now,
      updatedAt: now,
    },
    {
      key: "app.env",
      value: appConfig.env,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export class SystemSettingsSeeder implements Seeder {
  async run(db: Database, options: SeederRunOptions = {}) {
    const connection = options.connection ?? databaseConfig.connection;
    const context = options.context ?? createSeederContext();
    const seeds = buildSystemSettingSeeds(context.now);
    const systemSettings = getSystemSettingsTable(connection);

    for (const seed of seeds) {
      await upsertSystemSettingSeed(db, connection, systemSettings, seed);
    }

    return seeds.length;
  }
}

export async function seedSystemSettings(
  db: Database,
  connection: DatabaseConnection = databaseConfig.connection,
  context: SeederContext = createSeederContext()
) {
  return new SystemSettingsSeeder().run(db, {
    connection,
    context,
  });
}

export async function clearSystemSetting(
  db: Database,
  key: string,
  connection: DatabaseConnection = databaseConfig.connection
) {
  const systemSettings = getSystemSettingsTable(connection);

  await (db as any).delete(systemSettings).where(eq(systemSettings.key, key));
}

async function upsertSystemSettingSeed(
  db: Database,
  connection: DatabaseConnection,
  systemSettings: ReturnType<typeof getSystemSettingsTable>,
  seed: SystemSettingSeed
) {
  const updateValues = {
    value: seed.value,
    updatedAt: seed.updatedAt,
  };
  const insert = (db as any).insert(systemSettings).values(seed);

  if (connection === "mysql") {
    return insert.onDuplicateKeyUpdate({
      set: updateValues,
    });
  }

  return insert.onConflictDoUpdate({
    target: systemSettings.key,
    set: updateValues,
  });
}
