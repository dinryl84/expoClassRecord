import type { AttendanceRecord, AttendanceStatus } from '@/types';
import { getAttendanceForSection } from '@/db/repositories/attendance';
import type { AttendancePeriodFilter } from './attendance';

/** The statuses listed on the Absences screen, in display order (Present is not listed). */
export const LISTED_STATUSES: AttendanceStatus[] = ['A', 'L', 'E', 'C'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month0: number): string {
  return MONTH_NAMES[month0] ?? '';
}

/**
 * One learner's non-present days (Absent / Late / Excused / Cutting) inside a
 * period, oldest first. Uses the same period rules as
 * getLearnerAttendanceTotals(): 'month' matches the YYYY-MM prefix, 'term'
 * matches start..end inclusive (and returns nothing if either date is unset).
 */
export function getLearnerNonPresentDays(
  sectionId: string,
  learnerId: string,
  period: AttendancePeriodFilter
): AttendanceRecord[] {
  let records = getAttendanceForSection(sectionId).filter(
    (r) => r.learnerId === learnerId && r.status !== 'P'
  );

  if (period.mode === 'month') {
    const prefix = `${period.year}-${String(period.month + 1).padStart(2, '0')}`;
    records = records.filter((r) => r.date.startsWith(prefix));
  } else if (period.mode === 'term') {
    const { start, end } = period;
    records = start && end ? records.filter((r) => r.date >= start && r.date <= end) : [];
  }

  return [...records].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** "2026-08-12" -> "August 12" (or "August 12, 2026" when withYear is true). */
export function formatDayLabel(date: string, withYear: boolean): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return `${monthName(m - 1)} ${d}${withYear ? `, ${y}` : ''}`;
}
