import type { LearnerNote } from '@/types';
import { uuid } from './id';
import { getNotesForLearner as _getNotesForLearner, putNote, deleteNote as _deleteNote } from '@/db/repositories/notes';

export const NOTE_CATEGORIES: {
  value: LearnerNote['category'];
  label: string;
  emoji: string;
  color: string;
}[] = [
  { value: 'other', label: 'Note', emoji: '📝', color: '#5B5B5B' },
];

export function categoryMeta(category: LearnerNote['category']) {
  return NOTE_CATEGORIES.find((c) => c.value === category) ?? NOTE_CATEGORIES[0];
}

export function getNotesForLearner(sectionId: string, learnerId: string): LearnerNote[] {
  return _getNotesForLearner(sectionId, learnerId).sort((a, b) => b.createdAt - a.createdAt);
}

export function addNote(input: {
  sectionId: string;
  learnerId: string;
  subjectId?: string;
  category: LearnerNote['category'];
  text?: string;
}): LearnerNote {
  const note: LearnerNote = {
    id: uuid(),
    sectionId: input.sectionId,
    learnerId: input.learnerId,
    subjectId: input.subjectId,
    category: input.category,
    text: input.text?.trim() || undefined,
    createdAt: Date.now(),
  };
  putNote(note);
  return note;
}

export function deleteNote(id: string): void {
  _deleteNote(id);
}

export function formatNoteDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
