import { describe, expect, it } from "bun:test";
import { getTableName } from "drizzle-orm";

import { systemSettingModel } from "../../app/Models/SystemSetting";
import {
  databaseSchemas,
  getDatabaseSchema,
  getSystemSettingsTable,
} from "../../config/Database/schema";
import { systemSettings as mysqlSystemSettings } from "../../config/drizzle/schemas/mysql/SystemSetting";
import { table as mysqlTable } from "../../config/drizzle/schemas/mysql/schema";
import { systemSettings as postgresqlSystemSettings } from "../../config/drizzle/schemas/postgresql/SystemSetting";
import { table as postgresqlTable } from "../../config/drizzle/schemas/postgresql/schema";
import { systemSettings as sqliteSystemSettings } from "../../config/drizzle/schemas/sqlite/SystemSetting";
import { table as sqliteTable } from "../../config/drizzle/schemas/sqlite/schema";

describe("systemSettings model", () => {
  it("keeps the application model in app/Models", () => {
    expect(systemSettingModel.tableName).toBe("system_settings");
  });

  it("maps configured Drizzle schemas to the system_settings model", () => {
    expect(getTableName(mysqlSystemSettings)).toBe("system_settings");
    expect(getTableName(postgresqlSystemSettings)).toBe("system_settings");
    expect(getTableName(sqliteSystemSettings)).toBe("system_settings");
    expect(mysqlTable.systemSettings).toBe(mysqlSystemSettings);
    expect(postgresqlTable.systemSettings).toBe(postgresqlSystemSettings);
    expect(sqliteTable.systemSettings).toBe(sqliteSystemSettings);
  });

  it("selects the active schema by connection", () => {
    expect(databaseSchemas.mysql.systemSettings).toBe(mysqlSystemSettings);
    expect(getDatabaseSchema("mysql").systemSettings).toBe(mysqlSystemSettings);
    expect(getDatabaseSchema("postgresql").systemSettings).toBe(
      postgresqlSystemSettings
    );
    expect(getDatabaseSchema("sqlite").systemSettings).toBe(sqliteSystemSettings);
    expect(getSystemSettingsTable("mysql")).toBe(mysqlSystemSettings);
  });
});
