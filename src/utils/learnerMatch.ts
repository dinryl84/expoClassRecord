import type { Learner } from '@/types';

/**
 * Reconciles a freshly-parsed roster (from an Excel re-import or a bulk-paste)
 * against the section's existing learners, so re-importing/re-pasting the
 * same names doesn't mint brand-new IDs for students who already exist.
 *
 * Attendance (`attendance.learnerId`), notes (`notes.learnerId`), and every
 * other subject's term scores (`term_scores.termsJson`, keyed by learner id)
 * are all keyed off `Learner.id`. If a name that already exists gets a new
 * id, all of that history becomes silently orphaned. This function keeps the
 * existing id whenever an incoming learner is recognizably the same person,
 * and only mints a new id for someone genuinely new.
 *
 * Matching is by normalized name + gender (case/whitespace-insensitive).
 * When `slot` is available on both sides (Excel imports carry it), an exact
 * name+gender+slot match is preferred first — this disambiguates two
 * students who happen to share a name. Each existing learner can be matched
 * at most once.
 */
export function reconcileLearners(existing: Learner[], incoming: Learner[]): Learner[] {
  const pools = new Map<string, Learner[]>();
  for (const l of existing) {
    const key = l.gender;
    const arr = pools.get(key) ?? [];
    arr.push(l);
    pools.set(key, arr);
  }

  return incoming.map((inc) => {
    const pool = pools.get(inc.gender);
    if (!pool || pool.length === 0) return inc;

    const incName = normalizeName(inc.name);

    let idx = -1;
    if (inc.slot != null) {
      idx = pool.findIndex((e) => e.slot === inc.slot && normalizeName(e.name) === incName);
    }
    if (idx === -1) {
      idx = pool.findIndex((e) => normalizeName(e.name) === incName);
    }
    if (idx === -1) return inc;

    const [match] = pool.splice(idx, 1);
    return { ...inc, id: match.id };
  });
}

function normalizeName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
}
