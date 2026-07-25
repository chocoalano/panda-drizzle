export const systemSettingModel = {
  tableName: "system_settings",
} as const;

export type SystemSetting = {
  id: number;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewSystemSetting = Omit<SystemSetting, "id">;
