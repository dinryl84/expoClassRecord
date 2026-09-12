import { getDb } from '../client';
import type { SchoolInfo } from '@/types';

const ROW_ID = 'default';

interface SchoolInfoRow {
  id: string;
  region: string;
  division: string;
  schoolId: string;
  schoolName: string;
  schoolYear: string;
  teacher: string;
  track: string;
  termDatesJson: string | null;
}

function toSchoolInfo(row: SchoolInfoRow): SchoolInfo {
  return {
    region: row.region,
    division: row.division,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    schoolYear: row.schoolYear,
    teacher: row.teacher,
    track: row.track,
    termDates: row.termDatesJson ? JSON.parse(row.termDatesJson) : undefined,
  };
}

export const defaultSchoolInfo: SchoolInfo = {
  region: 'Region XI',
  division: 'Davao Oriental',
  schoolId: '304300',
  schoolName: 'BAGANGA NATIONAL HIGH SCHOOL',
  schoolYear: '2026-2027',
  teacher: '',
  track: 'ACADEMIC',
  termDates: {
    1: { start: '', end: '' },
    2: { start: '', end: '' },
    3: { start: '', end: '' },
  },
};

export function getSchoolInfo(): SchoolInfo {
  const row = getDb().getFirstSync<SchoolInfoRow>('SELECT * FROM school_info WHERE id = ?', ROW_ID);
  return row ? toSchoolInfo(row) : defaultSchoolInfo;
}

export function putSchoolInfo(info: SchoolInfo) {
  getDb().runSync(
    `INSERT OR REPLACE INTO school_info
     (id, region, division, schoolId, schoolName, schoolYear, teacher, track, termDatesJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ROW_ID,
    info.region,
    info.division,
    info.schoolId,
    info.schoolName,
    info.schoolYear,
    info.teacher,
    info.track,
    info.termDates ? JSON.stringify(info.termDates) : null
  );
}

/** Backup export/import work with raw rows keyed by id, matching the PWA's schoolInfo table. */
export function getAllSchoolInfoRows(): (SchoolInfo & { id: string })[] {
  const rows = getDb().getAllSync<SchoolInfoRow>('SELECT * FROM school_info');
  return rows.map((r) => ({ id: r.id, ...toSchoolInfo(r) }));
}

export function replaceAllSchoolInfoRows(rows: (SchoolInfo & { id: string })[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllSchoolInfoRowsRaw(rows));
}

/** Same as replaceAllSchoolInfoRows but without its own transaction — for callers composing a larger atomic restore. */
export function replaceAllSchoolInfoRowsRaw(rows: (SchoolInfo & { id: string })[]) {
  const db = getDb();
  db.execSync('DELETE FROM school_info;');
  for (const r of rows) {
    db.runSync(
      `INSERT OR REPLACE INTO school_info
       (id, region, division, schoolId, schoolName, schoolYear, teacher, track, termDatesJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.id,
      r.region,
      r.division,
      r.schoolId,
      r.schoolName,
      r.schoolYear,
      r.teacher,
      r.track,
      r.termDates ? JSON.stringify(r.termDates) : null
    );
  }
}
