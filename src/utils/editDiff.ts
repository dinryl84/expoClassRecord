import type { ComponentScores } from '@/types';

/**
 * True if a value differs from its baseline. Treats null/undefined as equal
 * (an empty box that's still empty isn't an "edit").
 */
export function valuesDiffer(a: number | null | undefined, b: number | null | undefined): boolean {
  const av = a ?? null;
  const bv = b ?? null;
  return av !== bv;
}

/**
 * Checks a single score field (optionally at an array index, for ww/pt) on a
 * learner's scores against the baseline snapshot taken when the record was
 * duplicated. Returns false if there's no baseline to compare against
 * (i.e. this isn't a duplicate, or the field didn't exist yet).
 */
export function isScoreEdited(
  baseline: ComponentScores | undefined,
  current: ComponentScores | undefined,
  field: 'ww' | 'pt' | 'sa1' | 'sa2' | 'te',
  index: number | null = null
): boolean {
  if (!baseline || !current) return false;
  if (index !== null) {
    const baseArr = (baseline[field] as (number | null)[]) ?? [];
    const curArr = (current[field] as (number | null)[]) ?? [];
    return valuesDiffer(baseArr[index] ?? null, curArr[index] ?? null);
  }
  return valuesDiffer(baseline[field] as number | null, current[field] as number | null);
}

/** True if any written work, performance task, or summative field differs from baseline. */
export function hasAnyScoreChanged(
  baseline: ComponentScores | undefined,
  current: ComponentScores | undefined
): boolean {
  if (!baseline || !current) return false;
  const arrFields: ('ww' | 'pt')[] = ['ww', 'pt'];
  for (const f of arrFields) {
    const baseArr = (baseline[f] as (number | null)[]) ?? [];
    const curArr = (current[f] as (number | null)[]) ?? [];
    const len = Math.max(baseArr.length, curArr.length);
    for (let i = 0; i < len; i++) {
      if (valuesDiffer(baseArr[i] ?? null, curArr[i] ?? null)) return true;
    }
  }
  return (
    valuesDiffer(baseline.sa1, current.sa1) ||
    valuesDiffer(baseline.sa2, current.sa2) ||
    valuesDiffer(baseline.te, current.te)
  );
}
