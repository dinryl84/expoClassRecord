import { getDb } from '../client';
import type { AttendanceRecord } from '@/types';

export function getAttendanceForSection(sectionId: string): AttendanceRecord[] {
  return getDb().getAllSync<AttendanceRecord>(
    'SELECT * FROM attendance WHERE sectionId = ? ORDER BY date',
    sectionId
  );
}

export function getAttendanceForDate(sectionId: string, date: string): AttendanceRecord[] {
  return getDb().getAllSync<AttendanceRecord>(
    'SELECT * FROM attendance WHERE sectionId = ? AND date = ?',
    sectionId,
    date
  );
}

export function putAttendanceRecord(record: AttendanceRecord) {
  getDb().runSync(
    `INSERT OR REPLACE INTO attendance (id, sectionId, learnerId, date, status, remarks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    record.id,
    record.sectionId,
    record.learnerId,
    record.date,
    record.status,
    record.remarks ?? null
  );
}

export function deleteAttendanceRecord(id: string) {
  getDb().runSync('DELETE FROM attendance WHERE id = ?', id);
}

export function getAllAttendance(): AttendanceRecord[] {
  return getDb().getAllSync<AttendanceRecord>('SELECT * FROM attendance');
}

export function replaceAllAttendance(records: AttendanceRecord[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllAttendanceRaw(records));
}

/** Same as replaceAllAttendance but without its own transaction — for callers composing a larger atomic restore. */
export function replaceAllAttendanceRaw(records: AttendanceRecord[]) {
  const db = getDb();
  db.execSync('DELETE FROM attendance;');
  for (const r of records) putAttendanceRecord(r);
}
