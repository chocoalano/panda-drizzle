import type { DatabaseConnection } from "../../../config/database";
import type { Database } from "../../../config/Database/client";
import type { SeederContext } from "./faker";

export type SeederRunOptions = {
  connection?: DatabaseConnection;
  context?: SeederContext;
};

export interface Seeder {
  run(db: Database, options?: SeederRunOptions): Promise<number>;
}
