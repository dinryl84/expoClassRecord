import { getDb } from '../client';
import type { SettingRow } from '@/types';

export function getSetting<T = unknown>(key: string): T | null {
  const db = getDb();
  const row = db.getFirstSync<{ valueJson: string }>(
    'SELECT valueJson FROM settings WHERE key = ?',
    key
  );
  if (!row) return null;
  return JSON.parse(row.valueJson) as T;
}

export function putSetting(key: string, value: unknown) {
  getDb().runSync(
    'INSERT OR REPLACE INTO settings (key, valueJson) VALUES (?, ?)',
    key,
    JSON.stringify(value)
  );
}

export function deleteSetting(key: string) {
  getDb().runSync('DELETE FROM settings WHERE key = ?', key);
}

export function getAllSettings(): SettingRow[] {
  const rows = getDb().getAllSync<{ key: string; valueJson: string }>(
    'SELECT key, valueJson FROM settings'
  );
  return rows.map((r) => ({ key: r.key, value: JSON.parse(r.valueJson) }));
}

export function replaceAllSettings(settings: SettingRow[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllSettingsRaw(settings));
}

/** Same as replaceAllSettings but without its own transaction — for callers composing a larger atomic restore. */
export function replaceAllSettingsRaw(settings: SettingRow[]) {
  const db = getDb();
  db.execSync('DELETE FROM settings;');
  for (const s of settings) {
    db.runSync(
      'INSERT OR REPLACE INTO settings (key, valueJson) VALUES (?, ?)',
      s.key,
      JSON.stringify(s.value)
    );
  }
}

// --- convenience wrappers matching the PWA's db/index.ts + utils/backup.ts helpers ---

export function getCurrentUser(): string | null {
  return getSetting<string>('currentUser');
}
export function setCurrentUser(username: string | null) {
  if (username) putSetting('currentUser', username);
  else deleteSetting('currentUser');
}

export function getLastBackupAt(): number | null {
  return getSetting<number>('lastBackupAt');
}
export function setLastBackupAt(timestamp: number) {
  putSetting('lastBackupAt', timestamp);
}

const SNOOZE_KEY = 'backupReminderSnoozedUntil';
export function getSnoozedUntil(): number | null {
  return getSetting<number>(SNOOZE_KEY);
}
export function snoozeBackupReminder(days: number) {
  putSetting(SNOOZE_KEY, Date.now() + days * 24 * 60 * 60 * 1000);
}
export function clearSnooze() {
  deleteSetting(SNOOZE_KEY);
}
