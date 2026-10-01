import { getDb } from './client';
import { getTermScoresForSubject, putTermScores } from './repositories/termScores';
import type { Section, TermScores } from '@/types';

export interface LearnerRecordCounts {
  attendance: number;
  notes: number;
}

/** How many attendance records and notes belong to one learner (shown in the delete confirmation). */
export function getLearnerRecordCounts(sectionId: string, learnerId: string): LearnerRecordCounts {
  const db = getDb();
  const att = db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM attendance WHERE sectionId = ? AND learnerId = ?',
    sectionId,
    learnerId
  );
  const notes = db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notes WHERE sectionId = ? AND learnerId = ?',
    sectionId,
    learnerId
  );
  return { attendance: att?.n ?? 0, notes: notes?.n ?? 0 };
}

/** Returns a copy of `terms` without the learner's scores, plus whether anything was actually removed. */
function withoutLearner(
  terms: TermScores[] | undefined,
  learnerId: string
): { terms: TermScores[] | undefined; changed: boolean } {
  if (!terms) return { terms, changed: false };
  let changed = false;
  const next = terms.map((t) => {
    if (!t.scores || !(learnerId in t.scores)) return t;
    changed = true;
    const { [learnerId]: _removed, ...rest } = t.scores;
    return { ...t, scores: rest };
  });
  return { terms: next, changed };
}

/**
 * Permanently deletes one learner and everything stored under that learner's
 * id, all in ONE transaction (either everything is removed or nothing is):
 *  - the learner row
 *  - their attendance records
 *  - their notes
 *  - their scores in every subject of the section (current + baseline)
 *
 * Other learners are not touched and `order` / `slot` are NOT renumbered
 * (same as the existing Remove behavior).
 */
export function deleteLearnerPermanently(section: Section, learnerId: string): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM learners WHERE id = ? AND sectionId = ?', learnerId, section.id);
    db.runSync('DELETE FROM attendance WHERE sectionId = ? AND learnerId = ?', section.id, learnerId);
    db.runSync('DELETE FROM notes WHERE sectionId = ? AND learnerId = ?', section.id, learnerId);

    for (const subject of section.subjects) {
      const row = getTermScoresForSubject(subject.id);
      if (!row) continue;
      const current = withoutLearner(row.terms, learnerId);
      const baseline = withoutLearner(row.baselineTerms, learnerId);
      if (!current.changed && !baseline.changed) continue;
      putTermScores({
        ...row,
        terms: current.terms ?? row.terms,
        baselineTerms: baseline.terms,
      });
    }
  });
}