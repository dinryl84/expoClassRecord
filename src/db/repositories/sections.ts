import { getDb } from '../client';
import type { Learner, Section, Subject } from '@/types';

interface SectionRow {
  id: string;
  name: string;
  gradeLevel: number;
  isDuplicate: number | null;
  duplicatedFromId: string | null;
  duplicatedFromName: string | null;
  duplicatedAt: number | null;
}

function toSection(row: SectionRow, learners: Learner[], subjects: Subject[]): Section {
  return {
    id: row.id,
    name: row.name,
    gradeLevel: row.gradeLevel as 11 | 12,
    learners,
    subjects,
    isDuplicate: row.isDuplicate ? true : undefined,
    duplicatedFromId: row.duplicatedFromId ?? undefined,
    duplicatedFromName: row.duplicatedFromName ?? undefined,
    duplicatedAt: row.duplicatedAt ?? undefined,
  };
}

export function getAllSections(): Section[] {
  const db = getDb();
  const sectionRows = db.getAllSync<SectionRow>('SELECT * FROM sections ORDER BY name');
  const learnerRows = db.getAllSync<Learner & { sectionId: string }>(
    'SELECT id, sectionId, name, gender, "order", slot FROM learners ORDER BY "order"'
  );
  const subjectRows = db.getAllSync<Subject>('SELECT * FROM subjects');

  return sectionRows.map((row) =>
    toSection(
      row,
      learnerRows.filter((l) => l.sectionId === row.id).map(({ sectionId: _s, ...l }) => l),
      subjectRows.filter((s) => s.sectionId === row.id)
    )
  );
}

export function getSectionById(id: string): Section | null {
  const db = getDb();
  const row = db.getFirstSync<SectionRow>('SELECT * FROM sections WHERE id = ?', id);
  if (!row) return null;
  const learners = db
    .getAllSync<Learner & { sectionId: string }>(
      'SELECT id, sectionId, name, gender, "order", slot FROM learners WHERE sectionId = ? ORDER BY "order"',
      id
    )
    .map(({ sectionId: _s, ...l }) => l);
  const subjects = db.getAllSync<Subject>('SELECT * FROM subjects WHERE sectionId = ?', id);
  return toSection(row, learners, subjects);
}

export function putSection(section: Section) {
  const db = getDb();
  db.withTransactionSync(() => putSectionRaw(section));
}

/** Same as putSection but without its own transaction — for callers composing a larger atomic operation. */
export function putSectionRaw(section: Section) {
  upsertSectionRow(section);
  replaceLearnersFor(section.id, section.learners);
  replaceSubjectsFor(section.id, section.subjects);
}

export function deleteSection(id: string) {
  const db = getDb();
  db.withTransactionSync(() => deleteSectionRaw(id));
}

/** Same as deleteSection but without its own transaction — for callers composing a larger atomic operation. */
export function deleteSectionRaw(id: string) {
  const db = getDb();
  db.runSync('DELETE FROM learners WHERE sectionId = ?', id);
  db.runSync('DELETE FROM subjects WHERE sectionId = ?', id);
  db.runSync('DELETE FROM sections WHERE id = ?', id);
}

// --- internals -------------------------------------------------------------

function upsertSectionRow(section: Section) {
  getDb().runSync(
    `INSERT OR REPLACE INTO sections
     (id, name, gradeLevel, isDuplicate, duplicatedFromId, duplicatedFromName, duplicatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    section.id,
    section.name,
    section.gradeLevel,
    section.isDuplicate ? 1 : 0,
    section.duplicatedFromId ?? null,
    section.duplicatedFromName ?? null,
    section.duplicatedAt ?? null
  );
}

function replaceLearnersFor(sectionId: string, learners: Learner[]) {
  const db = getDb();
  db.runSync('DELETE FROM learners WHERE sectionId = ?', sectionId);
  for (const l of learners) {
    db.runSync(
      'INSERT INTO learners (id, sectionId, name, gender, "order", slot) VALUES (?, ?, ?, ?, ?, ?)',
      l.id,
      sectionId,
      l.name,
      l.gender,
      l.order,
      l.slot ?? null
    );
  }
}

function replaceSubjectsFor(sectionId: string, subjects: Subject[]) {
  const db = getDb();
  db.runSync('DELETE FROM subjects WHERE sectionId = ?', sectionId);
  for (const s of subjects) {
    db.runSync(
      'INSERT INTO subjects (id, sectionId, name, subjectType, otherElectiveName) VALUES (?, ?, ?, ?, ?)',
      s.id,
      sectionId,
      s.name,
      s.subjectType,
      s.otherElectiveName ?? null
    );
  }
}

/** Backup restore: wipe + bulk-insert, same "replace everything" semantics as the PWA restore. */
export function replaceAllSections(sections: Section[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllSectionsRaw(sections));
}

/** Same as replaceAllSections but without its own transaction — for callers composing a larger atomic restore. */
export function replaceAllSectionsRaw(sections: Section[]) {
  const db = getDb();
  db.execSync('DELETE FROM learners; DELETE FROM subjects; DELETE FROM sections;');
  for (const section of sections) {
    upsertSectionRow(section);
    replaceLearnersFor(section.id, section.learners);
    replaceSubjectsFor(section.id, section.subjects);
  }
}
