import { systemSettings } from "./SystemSetting";

export { systemSettings };

export const table = {
  systemSettings,
} as const;

export type Table = typeof table;
