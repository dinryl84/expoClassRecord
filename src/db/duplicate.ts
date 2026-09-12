import type { Section, Subject, Learner, TermScores, AttendanceRecord } from '@/types';
import { uuid } from '@/utils/id';
import { getDb } from '@/db/client';
import { putSection, putSectionRaw, deleteSectionRaw } from '@/db/repositories/sections';
import {
  getTermScoresForSubject,
  putTermScores,
  deleteTermScoresById,
} from '@/db/repositories/termScores';
import {
  getAttendanceForSection,
  putAttendanceRecord,
  deleteAttendanceRecord,
} from '@/db/repositories/attendance';

// Hermes doesn't reliably ship structuredClone; scores/attendance are plain
// JSON-serializable data, so a JSON round-trip is a safe, simple stand-in.
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Creates a fully independent copy of a section: new IDs for the section,
 * every learner, and every subject, with all term scores and attendance
 * records cloned and re-keyed to match. Nothing in the copy shares an ID
 * with the original, so editing or deleting the copy can never affect it.
 *
 * A "baseline" snapshot of each subject's scores is stored alongside the
 * copy (termScores.baselineTerms) at the moment of duplication, so the UI
 * can later tell which values the user has actually changed since the copy
 * was made.
 */
export function duplicateSection(original: Section, newName: string): Section {
  const newSectionId = uuid();

  const learnerIdMap = new Map<string, string>();
  const newLearners: Learner[] = original.learners.map((l) => {
    const newId = uuid();
    learnerIdMap.set(l.id, newId);
    return { ...l, id: newId };
  });

  const subjectIdMap = new Map<string, string>();
  const newSubjects: Subject[] = original.subjects.map((s) => {
    const newId = uuid();
    subjectIdMap.set(s.id, newId);
    return { ...s, id: newId, sectionId: newSectionId };
  });

  const newSection: Section = {
    ...original,
    id: newSectionId,
    name: newName,
    learners: newLearners,
    subjects: newSubjects,
    isDuplicate: true,
    duplicatedFromId: original.id,
    duplicatedFromName: original.name,
    duplicatedAt: Date.now(),
  };

  const db = getDb();
  db.withTransactionSync(() => {
    putSectionRaw(newSection);

    for (const oldSubject of original.subjects) {
      const newSubjectId = subjectIdMap.get(oldSubject.id)!;
      const row = getTermScoresForSubject(oldSubject.id);
      if (!row) continue;

      const newTerms: TermScores[] = row.terms.map((t) => {
        const remapped: Record<string, any> = {};
        for (const [key, val] of Object.entries(t.scores)) {
          const newKey = key === '__hps__' ? key : learnerIdMap.get(key) ?? key;
          remapped[newKey] = jsonClone(val);
        }
        return { term: t.term, scores: remapped as TermScores['scores'] };
      });

      putTermScores({
        id: `${newSubjectId}-scores`,
        subjectId: newSubjectId,
        terms: newTerms,
        // Snapshot at the moment of duplication — used to detect edits later.
        baselineTerms: jsonClone(newTerms),
      });
    }

    const attRows = getAttendanceForSection(original.id);
    for (const a of attRows) {
      const newRecord: AttendanceRecord = {
        ...a,
        id: uuid(),
        sectionId: newSectionId,
        learnerId: learnerIdMap.get(a.learnerId) ?? a.learnerId,
      };
      putAttendanceRecord(newRecord);
    }
  });

  return newSection;
}

/** Deletes a duplicated section along with its cloned scores and attendance. */
export function deleteDuplicateSection(section: Section): void {
  const db = getDb();
  db.withTransactionSync(() => {
    // sections repo's deleteSectionRaw already cascades learners/subjects;
    // term scores and attendance rows aren't FK-linked, so clear them explicitly.
    for (const subj of section.subjects) {
      const row = getTermScoresForSubject(subj.id);
      if (row) deleteTermScoresById(row.id);
    }
    for (const a of getAttendanceForSection(section.id)) {
      deleteAttendanceRecord(a.id);
    }
    deleteSectionRaw(section.id);
  });
}

/** Renames a duplicated section. A single-table write — the transactional putSection wrapper is enough on its own. */
export function renameDuplicateSection(section: Section, newName: string): Section {
  const updated: Section = { ...section, name: newName.trim().toUpperCase() };
  putSection(updated);
  return updated;
}
