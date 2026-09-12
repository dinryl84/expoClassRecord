import type { AttendanceRecord, AttendanceStatus, Learner } from '@/types';
import { uuid } from './id';
import {
  getAttendanceForSection,
  getAttendanceForDate,
  putAttendanceRecord,
  deleteAttendanceRecord,
} from '@/db/repositories/attendance';

/** YYYY-MM-DD in local time */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function formatDisplayDate(key: string): string {
  const d = parseDateKey(key);
  return d.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

/** All date keys in a month (1..last day) */
export function daysInMonth(year: number, month: number): string[] {
  const last = new Date(year, month + 1, 0).getDate();
  const keys: string[] = [];
  for (let d = 1; d <= last; d++) {
    keys.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return keys;
}

export function getAttendanceForDay(sectionId: string, date: string): AttendanceRecord[] {
  return getAttendanceForDate(sectionId, date);
}

export function getAttendanceForMonth(sectionId: string, year: number, month: number): AttendanceRecord[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return getAttendanceForSection(sectionId).filter((r) => r.date.startsWith(prefix));
}

export function setAttendanceStatus(
  sectionId: string,
  learnerId: string,
  date: string,
  status: AttendanceStatus | null,
  remarks?: string
): void {
  const existing = getAttendanceForDate(sectionId, date).find((r) => r.learnerId === learnerId);

  if (status === null) {
    if (existing) deleteAttendanceRecord(existing.id);
    return;
  }

  if (existing) {
    putAttendanceRecord({ ...existing, status, remarks: remarks ?? existing.remarks });
  } else {
    putAttendanceRecord({ id: uuid(), sectionId, learnerId, date, status, remarks });
  }
}

export function markAllPresent(sectionId: string, date: string, learners: Learner[]): void {
  const existing = getAttendanceForDay(sectionId, date);
  const byLearner = new Map(existing.map((r) => [r.learnerId, r]));
  for (const learner of learners) {
    const prev = byLearner.get(learner.id);
    if (prev) putAttendanceRecord({ ...prev, status: 'P' });
    else putAttendanceRecord({ id: uuid(), sectionId, learnerId: learner.id, date, status: 'P' });
  }
}

export function clearDay(sectionId: string, date: string): void {
  for (const r of getAttendanceForDay(sectionId, date)) deleteAttendanceRecord(r.id);
}

export function copyFromPreviousDay(sectionId: string, targetDate: string, learners: Learner[]): number {
  const prevDate = addDays(targetDate, -1);
  const prev = getAttendanceForDay(sectionId, prevDate);
  if (prev.length === 0) return 0;

  const learnerIds = new Set(learners.map((l) => l.id));
  const toCopy = prev.filter((r) => learnerIds.has(r.learnerId));

  for (const r of getAttendanceForDay(sectionId, targetDate)) deleteAttendanceRecord(r.id);
  for (const r of toCopy) {
    putAttendanceRecord({ id: uuid(), sectionId, learnerId: r.learnerId, date: targetDate, status: r.status, remarks: r.remarks });
  }

  return toCopy.length;
}

export interface DaySummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  cutting: number;
  unmarked: number;
  total: number;
  rate: number | null;
}

export function summarizeDay(learners: Learner[], records: AttendanceRecord[]): DaySummary {
  const byId = new Map(records.map((r) => [r.learnerId, r.status]));
  let present = 0, absent = 0, late = 0, excused = 0, cutting = 0, unmarked = 0;

  for (const l of learners) {
    const s = byId.get(l.id);
    if (s === 'P') present++;
    else if (s === 'A') absent++;
    else if (s === 'L') late++;
    else if (s === 'E') excused++;
    else if (s === 'C') cutting++;
    else unmarked++;
  }

  const total = learners.length;
  const counted = present + late + excused;
  const marked = present + absent + late + excused + cutting;
  // NOTE: this rate's denominator is the section's full roster (`total`),
  // not just the marked students — an unmarked learner counts against the
  // rate the same way an absence would. This differs on purpose from
  // tallyRecords()/summarizeMonthPerLearner() below, whose denominator is
  // only the days actually marked (`totalMarked`). Both are intentional,
  // just answering different questions: "how present was the class today"
  // (roster-wide) vs. "of the days this learner had a mark, how present
  // were they" (marked-days-only). Keep this comment in sync if either
  // changes — it's easy to mistake one for a bug version of the other.
  const rate = marked > 0 ? Math.round((counted / total) * 1000) / 10 : null;

  return { present, absent, late, excused, cutting, unmarked, total, rate };
}

export interface LearnerMonthStats {
  learnerId: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  cutting: number;
  totalMarked: number;
  rate: number | null;
}

export function summarizeMonthPerLearner(learners: Learner[], records: AttendanceRecord[]): LearnerMonthStats[] {
  const map = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const list = map.get(r.learnerId) ?? [];
    list.push(r);
    map.set(r.learnerId, list);
  }

  return learners.map((l) => {
    const list = map.get(l.id) ?? [];
    let present = 0, absent = 0, late = 0, excused = 0, cutting = 0;
    for (const r of list) {
      if (r.status === 'P') present++;
      else if (r.status === 'A') absent++;
      else if (r.status === 'L') late++;
      else if (r.status === 'E') excused++;
      else if (r.status === 'C') cutting++;
    }
    const totalMarked = present + absent + late + excused + cutting;
    const counted = present + late + excused;
    const rate = totalMarked > 0 ? Math.round((counted / totalMarked) * 1000) / 10 : null;
    return { learnerId: l.id, present, absent, late, excused, cutting, totalMarked, rate };
  });
}

/** Attendance tally for a single learner within a section. */
export interface LearnerAttendanceTotals {
  present: number;
  absent: number;
  late: number;
  excused: number;
  cutting: number;
  totalMarked: number;
  rate: number | null;
}

export type AttendancePeriodFilter =
  | { mode: 'all' }
  | { mode: 'month'; year: number; month: number }
  | { mode: 'term'; term: 1 | 2 | 3; start: string; end: string };

function tallyRecords(records: AttendanceRecord[]): LearnerAttendanceTotals {
  let present = 0, absent = 0, late = 0, excused = 0, cutting = 0;
  for (const r of records) {
    if (r.status === 'P') present++;
    else if (r.status === 'A') absent++;
    else if (r.status === 'L') late++;
    else if (r.status === 'E') excused++;
    else if (r.status === 'C') cutting++;
  }
  const totalMarked = present + absent + late + excused + cutting;
  const counted = present + late + excused;
  // NOTE: denominator is `totalMarked` (days this learner actually has a
  // record for), unlike summarizeDay()'s roster-wide denominator above.
  // See the comment there for why the two intentionally differ.
  const rate = totalMarked > 0 ? Math.round((counted / totalMarked) * 1000) / 10 : null;
  return { present, absent, late, excused, cutting, totalMarked, rate };
}

/**
 * Tally one learner's attendance.
 * - mode 'all' -> every recorded day
 * - mode 'month' -> only dates in that calendar month (year + 0-based month)
 * - mode 'term' -> only dates between start and end inclusive (YYYY-MM-DD)
 */
export function getLearnerAttendanceTotals(
  sectionId: string,
  learnerId: string,
  period: AttendancePeriodFilter = { mode: 'all' }
): LearnerAttendanceTotals {
  let records = getAttendanceForSection(sectionId).filter((r) => r.learnerId === learnerId);

  if (period.mode === 'month') {
    const prefix = `${period.year}-${String(period.month + 1).padStart(2, '0')}`;
    records = records.filter((r) => r.date.startsWith(prefix));
  } else if (period.mode === 'term') {
    const { start, end } = period;
    records = start && end ? records.filter((r) => r.date >= start && r.date <= end) : [];
  }

  return tallyRecords(records);
}

/** Distinct year-months that have at least one attendance mark for this learner. */
export function getLearnerAttendanceMonths(sectionId: string, learnerId: string): { year: number; month: number }[] {
  const records = getAttendanceForSection(sectionId).filter((r) => r.learnerId === learnerId);
  const set = new Set<string>();
  for (const r of records) {
    if (r.date && r.date.length >= 7) set.add(r.date.slice(0, 7));
  }
  return [...set]
    .sort()
    .reverse()
    .map((ym) => {
      const [y, m] = ym.split('-').map(Number);
      return { year: y, month: m - 1 };
    });
}

/** Per-section snapshot for a single day (used by Dashboard). */
export interface SectionDaySnapshot {
  sectionId: string;
  sectionName: string;
  gradeLevel: 11 | 12;
  learnerCount: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  cutting: number;
  unmarked: number;
  rate: number | null;
  hasAnyMark: boolean;
}

export function getTodaySnapshotsForSections(
  sections: { id: string; name: string; gradeLevel: 11 | 12; learners: Learner[] }[],
  dateKey?: string
): SectionDaySnapshot[] {
  const date = dateKey ?? toDateKey();
  return sections.map((section) => {
    const records = getAttendanceForDay(section.id, date);
    const summary = summarizeDay(section.learners, records);
    return {
      sectionId: section.id,
      sectionName: section.name,
      gradeLevel: section.gradeLevel,
      learnerCount: section.learners.length,
      present: summary.present,
      absent: summary.absent,
      late: summary.late,
      excused: summary.excused,
      cutting: summary.cutting,
      unmarked: summary.unmarked,
      rate: summary.rate,
      hasAnyMark: records.length > 0,
    };
  });
}
