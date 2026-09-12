export type SubjectType =
  | 'Core Subject (All Tracks)'
  | 'Academic Elective (All Other Electives)'
  | 'Academic Elective (Field Experience / Exposure, and Sports and Arts)'
  | 'TechPro Elective (All Other Electives)'
  | 'TechPro Elective (Work Immersion)';

export interface Weights {
  written: number;
  performance: number;
  quarterly: number;
}

/**
 * Weights ported verbatim from the PWA (Helper(IMPORTANT!)!CH2:CN6 in the
 * ECR template) — do not change without checking the source app too, or
 * grades computed on the two platforms will diverge.
 */
export const SUBJECT_WEIGHTS: Record<SubjectType, Weights> = {
  'Core Subject (All Tracks)': { written: 0.2, performance: 0.5, quarterly: 0.3 },
  'Academic Elective (All Other Electives)': { written: 0.2, performance: 0.5, quarterly: 0.3 },
  'Academic Elective (Field Experience / Exposure, and Sports and Arts)': {
    written: 0.15,
    performance: 0.7,
    quarterly: 0.15,
  },
  'TechPro Elective (All Other Electives)': { written: 0.15, performance: 0.65, quarterly: 0.2 },
  'TechPro Elective (Work Immersion)': { written: 0.2, performance: 0.8, quarterly: 0 },
};

export interface TermDateRange {
  /** YYYY-MM-DD inclusive */
  start: string;
  /** YYYY-MM-DD inclusive */
  end: string;
}

export interface SchoolInfo {
  region: string;
  division: string;
  schoolId: string;
  schoolName: string;
  schoolYear: string;
  teacher: string;
  track: string;
  termDates?: {
    1?: TermDateRange;
    2?: TermDateRange;
    3?: TermDateRange;
  };
}

export interface LearnerNote {
  id: string;
  sectionId: string;
  learnerId: string;
  subjectId?: string;
  category: 'submitted' | 'missing' | 'materials_brought' | 'materials_missing' | 'other';
  text?: string;
  createdAt: number;
}

export interface Learner {
  id: string;
  name: string; // LAST, FIRST M.
  gender: 'Male' | 'Female';
  order: number;
  slot?: number;
}

export interface ComponentScores {
  ww: (number | null)[];
  wwHps: (number | null)[];
  pt: (number | null)[];
  ptHps: (number | null)[];
  sa1: number | null;
  sa2: number | null;
  te: number | null;
  sa1Hps: number | null;
  sa2Hps: number | null;
  teHps: number | null;
}

export interface TermScores {
  term: 1 | 2 | 3;
  scores: Record<string, ComponentScores>; // learnerId -> scores
}

export interface Subject {
  id: string;
  name: string;
  subjectType: SubjectType;
  otherElectiveName?: string;
  sectionId: string;
}

export interface Section {
  id: string;
  name: string;
  gradeLevel: 11 | 12;
  learners: Learner[];
  subjects: Subject[];
  isDuplicate?: boolean;
  duplicatedFromId?: string;
  duplicatedFromName?: string;
  duplicatedAt?: number;
}

export interface AppUser {
  username: string;
  passwordHash: string;
}

export interface CalculatedGrade {
  initial: number | null;
  transmuted: number | null;
  letter: string | null;
  wwTotal: number | null;
  wwPs: number | null;
  wwWs: number | null;
  ptTotal: number | null;
  ptPs: number | null;
  ptWs: number | null;
  qaTotal: number | null;
  qaPs: number | null;
  qaWs: number | null;
}

export type AttendanceStatus = 'P' | 'A' | 'L' | 'E' | 'C';

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  E: 'Excused',
  C: 'Cutting',
};

export interface AttendanceRecord {
  id: string;
  sectionId: string;
  learnerId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks?: string;
}

// ---------------------------------------------------------------------------
// Row shapes as they sit in SQLite (mirrors the Dexie table rows the PWA
// backup format uses under data.termScores / data.templates)
// ---------------------------------------------------------------------------

export interface TermScoresRow {
  id: string;
  subjectId: string;
  terms: TermScores[];
  baselineTerms?: TermScores[];
}

export interface TemplateRow {
  id: string;
  name: string;
  data: string; // base64, same encoding the PWA backup uses
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}
