import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const createDatabaseClient = (binding: D1Database) =>
  drizzle(binding, { schema });

export type AppDatabase = ReturnType<typeof createDatabaseClient>;
