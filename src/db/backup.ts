// SDK 54 moved documentDirectory/EncodingType/writeAsStringAsync/readAsStringAsync
// under a "legacy" subpath (the new default API is class-based: File/Directory).
// Using legacy here is a deliberate, low-risk choice for a straightforward,
// synchronous-feeling port — revisit if/when the app adopts the new API elsewhere.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { base64ToArrayBuffer } from '@/utils/base64';
import { getDb } from './client';
import { getAllUsers, replaceAllUsersRaw } from './repositories/users';
import { getAllSchoolInfoRows, replaceAllSchoolInfoRowsRaw } from './repositories/schoolInfo';
import { getAllSections, replaceAllSectionsRaw } from './repositories/sections';
import { getAllTermScores, replaceAllTermScoresRaw } from './repositories/termScores';
import { getAllSettings, replaceAllSettingsRaw } from './repositories/settings';
import { getAllTemplates, replaceAllTemplatesRaw } from './repositories/templates';
import { getAllAttendance, replaceAllAttendanceRaw } from './repositories/attendance';
import { getAllNotes, replaceAllNotesRaw } from './repositories/notes';
import {
  getLastBackupAt as _getLastBackupAt,
  setLastBackupAt,
  clearSnooze,
  getSnoozedUntil as _getSnoozedUntil,
  snoozeBackupReminder as _snoozeBackupReminder,
} from './repositories/settings';
import type { SettingRow, TemplateRow } from '@/types';

// These three constants, and the JSON shape below, MUST stay identical to
// the PWA's src/utils/backup.ts — this is what makes backup files
// interchangeable between the web app and this one.
const BACKUP_APP_ID = 'shs-class-record';
const BACKUP_VERSION = 1;
const SNOOZE_KEY = 'backupReminderSnoozedUntil';

export const getSnoozedUntil = _getSnoozedUntil;
export const snoozeBackupReminder = _snoozeBackupReminder;

export function formatBackupDate(ts: number | null): string {
  if (!ts) return 'Never';
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function daysSince(ts: number | null): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

export const getLastBackupAt = _getLastBackupAt;

// ---------------------------------------------------------------------------
// Backup (export)
// ---------------------------------------------------------------------------

export interface BackupResult {
  fileUri: string;
  shared: boolean;
}

export async function createBackup(): Promise<BackupResult> {
  const users = getAllUsers();
  const schoolInfo = getAllSchoolInfoRows();
  const sections = getAllSections();
  const termScores = getAllTermScores();
  const settings = getAllSettings().filter(
    (s: SettingRow) => s.key !== 'lastBackupAt' && s.key !== SNOOZE_KEY
  );
  const templates = getAllTemplates().map((t: TemplateRow) => ({
    id: t.id,
    name: t.name,
    updatedAt: t.updatedAt,
    // t.data is already base64 text at rest in SQLite (unlike the PWA's
    // ArrayBuffer-in-IndexedDB), so no re-encoding needed here.
    data: t.data,
  }));
  const attendance = getAllAttendance();
  const notes = getAllNotes();

  const backup = {
    appId: BACKUP_APP_ID,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { users, schoolInfo, sections, termScores, settings, templates, attendance, notes },
  };

  const json = JSON.stringify(backup, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileUri = `${FileSystem.documentDirectory}shs-class-record-backup-${stamp}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

  setLastBackupAt(Date.now());
  clearSnooze();

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Save SHS Class Record backup',
    });
    shared = true;
  }

  return { fileUri, shared };
}

// ---------------------------------------------------------------------------
// Restore (import) — destructive: replaces everything currently in the app.
// Accepts a backup made by either this app or the PWA.
// ---------------------------------------------------------------------------

export interface RestoreResult {
  message: string;
  sectionCount: number;
}

/** Opens the document picker, then restores whatever .json the user picks. */
export async function pickAndRestoreBackup(): Promise<RestoreResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return restoreBackupFromUri(result.assets[0].uri);
}

export async function restoreBackupFromUri(uri: string): Promise<RestoreResult> {
  const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON — it doesn't look like a backup made by this app.");
  }

  if (parsed?.appId !== BACKUP_APP_ID || !parsed?.data) {
    throw new Error("That file doesn't look like an SHS Class Record backup.");
  }

  if (typeof parsed.backupVersion === 'number' && parsed.backupVersion > BACKUP_VERSION) {
    throw new Error(
      'This backup was made by a newer version of the app. Update the app before restoring it.'
    );
  }

  const {
    users = [],
    schoolInfo = [],
    sections = [],
    termScores = [],
    settings = [],
    templates = [],
    attendance = [],
    notes = [],
  } = parsed.data;

  // Templates arrive as base64 text either way (that's how the PWA already
  // encodes them in its backup file) — round-trip through ArrayBuffer once
  // just to validate it decodes cleanly, then store as base64 text again.
  const restoredTemplates = templates.map((t: any) => {
    base64ToArrayBuffer(t.data); // throws if malformed
    return { id: t.id, name: t.name, updatedAt: t.updatedAt, data: t.data as string };
  });

  const db = getDb();
  db.withTransactionSync(() => {
    replaceAllUsersRaw(users);
    replaceAllSchoolInfoRowsRaw(schoolInfo);
    replaceAllSectionsRaw(sections);
    replaceAllTermScoresRaw(termScores);
    replaceAllSettingsRaw(settings);
    replaceAllTemplatesRaw(restoredTemplates);
    replaceAllAttendanceRaw(attendance);
    replaceAllNotesRaw(notes);
  });

  setLastBackupAt(Date.now());
  clearSnooze();

  return {
    message: `Restored ${sections.length} section${sections.length !== 1 ? 's' : ''}, ${
      attendance.length
    } attendance record${attendance.length !== 1 ? 's' : ''}.`,
    sectionCount: sections.length,
  };
}
