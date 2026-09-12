import type { Learner } from '@/types';
import { uuid } from './id';

/**
 * Parse bulk student names from pasted text or CSV.
 * Accepts formats:
 * - One name per line
 * - LAST, FIRST M.
 * - CSV with optional gender column
 * - Copied from SF1 (common DepEd format)
 */
export function parseBulkNames(
  text: string,
  defaultGender: 'Male' | 'Female' = 'Male'
): Learner[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const learners: Learner[] = [];
  let order = 1;

  for (const line of lines) {
    // Skip pure numbers or headers
    if (/^(name|learner|male|female|#|no\.?)$/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;

    let name = line;
    let gender: 'Male' | 'Female' = defaultGender;

    // Try CSV: name, gender
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    if (parts.length >= 2) {
      const maybeGender = parts[parts.length - 1].toLowerCase();
      if (maybeGender === 'm' || maybeGender === 'male') {
        gender = 'Male';
        name = parts.slice(0, -1).join(', ').trim();
      } else if (maybeGender === 'f' || maybeGender === 'female') {
        gender = 'Female';
        name = parts.slice(0, -1).join(', ').trim();
      } else {
        // Assume "LAST, FIRST" style already
        name = line;
      }
    }

    // Clean common prefixes like "1. " or "1)"
    name = name.replace(/^\d+[.)]\s*/, '').trim();

    if (name.length < 2) continue;

    // Normalize to UPPERCASE for consistency with DepEd ECR
    name = name.toUpperCase();

    learners.push({
      id: uuid(),
      name,
      gender,
      order: order++,
    });
  }

  return learners;
}

/** Split a mixed list into Male / Female while preserving order within gender */
export function splitByGender(learners: Learner[]): {
  male: Learner[];
  female: Learner[];
} {
  const male: Learner[] = [];
  const female: Learner[] = [];
  let mOrder = 1;
  let fOrder = 1;

  for (const l of learners) {
    if (l.gender === 'Male') {
      male.push({ ...l, order: mOrder++ });
    } else {
      female.push({ ...l, order: fOrder++ });
    }
  }
  return { male, female };
}
