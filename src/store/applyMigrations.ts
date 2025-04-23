import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url"; // Import fileURLToPath
import type { Database } from "better-sqlite3";
import { logger } from "../utils/logger";
import { StoreError } from "./errors";

// Use import.meta.url to get the directory path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Point to the new top-level db/migrations directory, relative to the compiled script location (dist/store)
const MIGRATIONS_DIR = path.resolve(__dirname, "../db/migrations");
const MIGRATIONS_TABLE = "_schema_migrations";

/**
 * Ensures the migration tracking table exists in the database.
 * @param db The database instance.
 */
function ensureMigrationsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Retrieves the set of already applied migration IDs (filenames) from the tracking table.
 * @param db The database instance.
 * @returns A Set containing the IDs of applied migrations.
 */
function getAppliedMigrations(db: Database): Set<string> {
  const stmt = db.prepare(`SELECT id FROM ${MIGRATIONS_TABLE}`);
  const rows = stmt.all() as Array<{ id: string }>;
  return new Set(rows.map((row) => row.id));
}

/**
 * Applies pending database migrations found in the migrations directory.
 * Migrations are expected to be .sql files with sequential prefixes (e.g., 001-, 002-).
 * It tracks applied migrations in the _schema_migrations table.
 *
 * @param db The better-sqlite3 database instance.
 * @throws {StoreError} If any migration fails.
 */
export function applyMigrations(db: Database): void {
  try {
    logger.debug("Applying database migrations...");
    ensureMigrationsTable(db);
    const appliedMigrations = getAppliedMigrations(db);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      logger.debug("Migrations directory not found, skipping.");
      return;
    }

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Sort alphabetically, relying on naming convention (001-, 002-)

    let appliedCount = 0;
    for (const filename of migrationFiles) {
      if (!appliedMigrations.has(filename)) {
        logger.debug(`Applying migration: ${filename}`);
        const filePath = path.join(MIGRATIONS_DIR, filename);
        const sql = fs.readFileSync(filePath, "utf8");

        // Run migration within a transaction
        const transaction = db.transaction(() => {
          db.exec(sql);
          const insertStmt = db.prepare(
            `INSERT INTO ${MIGRATIONS_TABLE} (id) VALUES (?)`,
          );
          insertStmt.run(filename);
        });

        try {
          transaction();
          logger.debug(`Successfully applied migration: ${filename}`);
          appliedCount++;
        } catch (error) {
          logger.error(`Failed to apply migration: ${filename} - ${error}`);
          // Let the transaction implicitly rollback on error
          throw new StoreError(`Migration failed: ${filename} - ${error}`);
        }
      }
    }

    if (appliedCount > 0) {
      logger.debug(`Applied ${appliedCount} new migration(s).`);
    } else {
      logger.debug("Database schema is up to date.");
    }
  } catch (error) {
    // Ensure StoreError is thrown for consistent handling
    if (error instanceof StoreError) {
      throw error;
    }
    throw new StoreError("Failed during migration process", error);
  }
}
