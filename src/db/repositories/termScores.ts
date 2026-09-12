import { getDb } from '../client';
import type { TermScoresRow } from '@/types';

interface Row {
  id: string;
  subjectId: string;
  termsJson: string;
  baselineTermsJson: string | null;
}

function toTermScoresRow(row: Row): TermScoresRow {
  return {
    id: row.id,
    subjectId: row.subjectId,
    terms: JSON.parse(row.termsJson),
    baselineTerms: row.baselineTermsJson ? JSON.parse(row.baselineTermsJson) : undefined,
  };
}

export function getAllTermScores(): TermScoresRow[] {
  return getDb().getAllSync<Row>('SELECT * FROM term_scores').map(toTermScoresRow);
}

export function getTermScoresForSubject(subjectId: string): TermScoresRow | null {
  const row = getDb().getFirstSync<Row>('SELECT * FROM term_scores WHERE subjectId = ?', subjectId);
  return row ? toTermScoresRow(row) : null;
}

export function putTermScores(row: TermScoresRow) {
  getDb().runSync(
    'INSERT OR REPLACE INTO term_scores (id, subjectId, termsJson, baselineTermsJson) VALUES (?, ?, ?, ?)',
    row.id,
    row.subjectId,
    JSON.stringify(row.terms),
    row.baselineTerms ? JSON.stringify(row.baselineTerms) : null
  );
}

export function deleteTermScoresById(id: string) {
  getDb().runSync('DELETE FROM term_scores WHERE id = ?', id);
}

export function replaceAllTermScores(rows: TermScoresRow[]) {
  const db = getDb();
  db.withTransactionSync(() => replaceAllTermScoresRaw(rows));
}

/** Same as replaceAllTermScores but without its own transaction — for callers composing a larger atomic restore. */
export function replaceAllTermScoresRaw(rows: TermScoresRow[]) {
  const db = getDb();
  db.execSync('DELETE FROM term_scores;');
  for (const row of rows) putTermScores(row);
}
