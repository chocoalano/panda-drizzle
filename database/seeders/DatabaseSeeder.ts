import { databaseConfig } from "../../config/database";
import type { Database } from "../../config/Database/client";
import {
  createSeederContext,
  summarizeSeederContext,
} from "../../app/Support/Seeders/faker";
import type { SeederRunOptions } from "../../app/Support/Seeders/Seeder";
import { SystemSettingsSeeder } from "./SystemSettingsSeeder";

export type DatabaseSeederOptions = SeederRunOptions;

export type DatabaseSeederResult = {
  faker: ReturnType<typeof summarizeSeederContext>;
  systemSettings: number;
};

export class DatabaseSeeder {
  constructor(
    private readonly systemSettingsSeeder = new SystemSettingsSeeder()
  ) {}

  async run(
    db: Database,
    options: DatabaseSeederOptions = {}
  ): Promise<DatabaseSeederResult> {
    const context = options.context ?? createSeederContext();
    const connection = options.connection ?? databaseConfig.connection;
    const systemSettings = await this.systemSettingsSeeder.run(db, {
      connection,
      context,
    });

    return {
      faker: summarizeSeederContext(context),
      systemSettings,
    };
  }
}
