import { getDb, getSqlite } from "./client";
import { getDatabasePath } from "../core/config/paths";

/**
 * For scripts/db:migrate: opens the DB in the data directory and applies the schema.
 * getDb() already runs the migration idempotently.
 */
function main(): void {
  getDb();
  getSqlite().close();
  console.log(`Migration completed: ${getDatabasePath()}`);
}

main();
