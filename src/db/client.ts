import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const DB_NAME = 'shsclassrecord.db';
const DB_VERSION = 1;

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (_db) return _db;
  _db = SQLite.openDatabaseSync(DB_NAME);
  // SQLite disables FK enforcement by default per connection — the schema's
  // `ON DELETE CASCADE` declarations are inert without this.
  _db.execSync('PRAGMA foreign_keys = ON;');
  migrate(_db);
  return _db;
}

function migrate(db: SQLite.SQLiteDatabase) {
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion < DB_VERSION) {
    db.execSync(SCHEMA_SQL);
    db.execSync(`PRAGMA user_version = ${DB_VERSION}`);
  }
}

/** Test-only / settings-screen escape hatch — wipes every table. */
export function clearAllTables() {
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync(`
      DELETE FROM users;
      DELETE FROM school_info;
      DELETE FROM sections;
      DELETE FROM learners;
      DELETE FROM subjects;
      DELETE FROM term_scores;
      DELETE FROM settings;
      DELETE FROM templates;
      DELETE FROM attendance;
      DELETE FROM notes;
    `);
  });
}
