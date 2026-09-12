// Schema notes (read this before touching Phase 2+ repositories):
//
// The PWA's Dexie tables (users, schoolInfo, termScores, settings, templates,
// attendance, notes) are already flat, one-row-per-item — they map straight
// across, no redesign needed.
//
// The one real structural change is `sections`: in Dexie a Section document
// carries `learners[]` and `subjects[]` nested inline. Here they're their
// own tables with a sectionId foreign key, which is what SQLite is for.
// The backup import/export layer (src/utils/backup.ts) is what flattens/
// re-nests across that boundary — screens and repositories never have to
// think about it.
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY NOT NULL,
  passwordHash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS school_info (
  id TEXT PRIMARY KEY NOT NULL,
  region TEXT NOT NULL,
  division TEXT NOT NULL,
  schoolId TEXT NOT NULL,
  schoolName TEXT NOT NULL,
  schoolYear TEXT NOT NULL,
  teacher TEXT NOT NULL,
  track TEXT NOT NULL,
  termDatesJson TEXT
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  gradeLevel INTEGER NOT NULL,
  isDuplicate INTEGER,
  duplicatedFromId TEXT,
  duplicatedFromName TEXT,
  duplicatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY NOT NULL,
  sectionId TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  slot INTEGER,
  FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learners_section ON learners(sectionId);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY NOT NULL,
  sectionId TEXT NOT NULL,
  name TEXT NOT NULL,
  subjectType TEXT NOT NULL,
  otherElectiveName TEXT,
  FOREIGN KEY (sectionId) REFERENCES sections(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subjects_section ON subjects(sectionId);

CREATE TABLE IF NOT EXISTS term_scores (
  id TEXT PRIMARY KEY NOT NULL,
  subjectId TEXT NOT NULL,
  termsJson TEXT NOT NULL,
  baselineTermsJson TEXT
);
CREATE INDEX IF NOT EXISTS idx_term_scores_subject ON term_scores(subjectId);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  valueJson TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY NOT NULL,
  sectionId TEXT NOT NULL,
  learnerId TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  remarks TEXT
);
CREATE INDEX IF NOT EXISTS idx_attendance_section_date ON attendance(sectionId, date);
CREATE INDEX IF NOT EXISTS idx_attendance_section_learner ON attendance(sectionId, learnerId);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  sectionId TEXT NOT NULL,
  learnerId TEXT NOT NULL,
  subjectId TEXT,
  category TEXT NOT NULL,
  text TEXT,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_section_learner ON notes(sectionId, learnerId);
`;
