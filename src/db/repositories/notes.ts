import { getDb } from '../client';
import type { LearnerNote } from '@/types';

export function getNotesForLearner(sectionId: string, learnerId: string): LearnerNote[] {
  return getDb().getAllSync<LearnerNote>(
    'SELECT * FROM notes WHERE sectionId = ? AND learnerId = ? ORDER BY createdAt DESC',
    sectionId,
    learnerId
  );
}

export function putNote(note: LearnerNote) {
  getDb().runSync(
    `INSERT OR REPLACE INTO notes (id, sectionId, learnerId, subjectId, category, text, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    note.id,
    note.sectionId,
    note.learnerId,
    note.subjectId ?? null,
    note.category,
    note.text ?? null,
    note.createdAt
  );
}

export function deleteNote(id: string) {
  getDb().runSync('DELETE FROM notes WHERE id = ?', id);
}

export function getAllNotes(): LearnerNote[] {
  return getDb().getAllSync<LearnerNote>('SELECT * FROM notes');
}

export function replaceAllNotes(notes: LearnerNote[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllNotesRaw(notes));
}

/** Same as replaceAllNotes but without its own transaction — for callers composing a larger atomic restore. */
export function replaceAllNotesRaw(notes: LearnerNote[]) {
  const db = getDb();
  db.execSync('DELETE FROM notes;');
  for (const n of notes) putNote(n);
}
