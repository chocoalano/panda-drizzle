import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { systemSettingModel } from "../../../../app/Models/SystemSetting";

export const systemSettings = sqliteTable(systemSettingModel.tableName, {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
