import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { ensureDataDirs, getDatabasePath } from "../core/config/paths";

let cachedDb: BetterSQLite3Database<typeof schema> | null = null;
let cachedSqlite: Database.Database | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (cachedDb) return cachedDb;
  return openDb();
}

function openDb(): BetterSQLite3Database<typeof schema> {
  ensureDataDirs();
  const dbPath = getDatabasePath();
  const sqlite = new Database(dbPath);
  // WAL ve foreign_keys her bağlantıda uygulanır.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder });
  }

  cachedDb = db;
  cachedSqlite = sqlite;
  return db;
}

export function getSqlite(): Database.Database {
  getDb();
  return cachedSqlite!;
}

/** Testler için süreç içi önbelleği sıfırlar. */
export function resetDbForTests(): void {
  cachedSqlite?.close();
  cachedDb = null;
  cachedSqlite = null;
}

export { schema };
