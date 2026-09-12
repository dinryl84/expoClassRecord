import type { ComponentScores, CalculatedGrade, SubjectType, Weights } from '@/types';
import { SUBJECT_WEIGHTS } from '@/types';
import { getSetting, putSetting } from '@/db/repositories/settings';

const WEIGHTS_SETTING_KEY = 'gradeWeights';

/** Runtime overrides loaded from the settings table (key: 'gradeWeights'). */
let customWeightsCache: Partial<Record<SubjectType, Weights>> | null | undefined;

function loadCustomWeights(): Partial<Record<SubjectType, Weights>> | null {
  if (customWeightsCache === undefined) {
    customWeightsCache = getSetting<Partial<Record<SubjectType, Weights>>>(WEIGHTS_SETTING_KEY);
  }
  return customWeightsCache;
}

/** Call after saving settings so all grade calculations use the new values. */
export function setCustomWeights(overrides: Partial<Record<SubjectType, Weights>> | null) {
  customWeightsCache = overrides;
  putSetting(WEIGHTS_SETTING_KEY, overrides);
}

/** Effective weights for a subject type (custom override → built-in DepEd defaults). */
export function getWeights(subjectType: SubjectType): Weights {
  const custom = loadCustomWeights()?.[subjectType];
  if (custom) return custom;
  return SUBJECT_WEIGHTS[subjectType] || SUBJECT_WEIGHTS['Core Subject (All Tracks)'];
}

/** Deep-clone the built-in DepEd defaults (safe to mutate for editing UIs). */
export function cloneDefaultWeights(): Record<SubjectType, Weights> {
  const out = {} as Record<SubjectType, Weights>;
  for (const key of Object.keys(SUBJECT_WEIGHTS) as SubjectType[]) {
    out[key] = { ...SUBJECT_WEIGHTS[key] };
  }
  return out;
}

/**
 * Transmuted-grade lookup table, extracted directly from this app's own
 * ECR template (Helper(IMPORTANT!)!CQ1:CR41), which the real workbook
 * looks up via VLOOKUP(InitialGrade, CQ1:CR41, 2, TRUE) — an approximate
 * ("largest threshold <= value") match. This is the adjusted SY 2026-2027
 * table per DepEd Order No. 015, s. 2026: Initial Grade 70 -> Transmuted
 * 75 (vs. Initial Grade 60 -> 75 under the old DO 8, s. 2015 table).
 */
const TRANSMUTATION: { threshold: number; grade: number }[] = [
  { threshold: 0, grade: 60 },
  { threshold: 40, grade: 61 },
  { threshold: 43, grade: 62 },
  { threshold: 46, grade: 63 },
  { threshold: 48, grade: 64 },
  { threshold: 50, grade: 65 },
  { threshold: 52, grade: 66 },
  { threshold: 54, grade: 67 },
  { threshold: 56, grade: 68 },
  { threshold: 58, grade: 69 },
  { threshold: 60, grade: 70 },
  { threshold: 62, grade: 71 },
  { threshold: 64, grade: 72 },
  { threshold: 66, grade: 73 },
  { threshold: 68, grade: 74 },
  { threshold: 70, grade: 75 },
  { threshold: 73, grade: 76 },
  { threshold: 75, grade: 77 },
  { threshold: 76, grade: 78 },
  { threshold: 77, grade: 79 },
  { threshold: 78, grade: 80 },
  { threshold: 79, grade: 81 },
  { threshold: 80, grade: 82 },
  { threshold: 81, grade: 83 },
  { threshold: 82, grade: 84 },
  { threshold: 83, grade: 85 },
  { threshold: 84, grade: 86 },
  { threshold: 85, grade: 87 },
  { threshold: 86, grade: 88 },
  { threshold: 87, grade: 89 },
  { threshold: 88, grade: 90 },
  { threshold: 89, grade: 91 },
  { threshold: 90, grade: 92 },
  { threshold: 91, grade: 93 },
  { threshold: 92, grade: 94 },
  { threshold: 93, grade: 95 },
  { threshold: 94, grade: 96 },
  { threshold: 95, grade: 97 },
  { threshold: 96, grade: 98 },
  { threshold: 97.5, grade: 99 },
  { threshold: 99.5, grade: 100 },
];

/** Round to 2 decimal places, matching the ROUND(...,2) used throughout the ECR formulas. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function transmute(initial: number): number {
  if (isNaN(initial)) return 60;
  if (initial >= 100) return 100;
  let result = TRANSMUTATION[0].grade;
  for (const row of TRANSMUTATION) {
    if (initial >= row.threshold) result = row.grade;
    else break;
  }
  return result;
}

/**
 * A/B/C/D/E cutoffs match this app's ECR template exactly (>=90/80/75/65),
 * which correspond to DepEd Order No. 015, s. 2026's Advancing /
 * Benchmarking / Connecting / Developing / Emerging descriptor bands —
 * not the old DO 8, s. 2015 Outstanding/VS/S/FS/DNME bands.
 */
export function letterGrade(transmuted: number): string {
  if (transmuted >= 90) return 'A';
  if (transmuted >= 80) return 'B';
  if (transmuted >= 75) return 'C';
  if (transmuted >= 65) return 'D';
  return 'E';
}

function sumValid(arr: (number | null)[]): number {
  return arr.reduce((acc: number, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

export function calculateGrade(
  scores: ComponentScores,
  subjectType: SubjectType,
  weightsOverride?: Weights
): CalculatedGrade {
  const weights: Weights = weightsOverride || getWeights(subjectType);

  // Written Works: PS = ROUND(Total/HPS*100, 2), WS = ROUND(PS*weight, 2)
  const wwScores = scores.ww || [];
  const wwHps = scores.wwHps || [];
  const wwTotal = sumValid(wwScores);
  const wwMax = sumValid(wwHps);
  const wwPs = wwMax > 0 ? round2((wwTotal / wwMax) * 100) : null;
  const wwWs = wwPs !== null ? round2(wwPs * weights.written) : null;

  // Performance Tasks: same pattern
  const ptScores = scores.pt || [];
  const ptHps = scores.ptHps || [];
  const ptTotal = sumValid(ptScores);
  const ptMax = sumValid(ptHps);
  const ptPs = ptMax > 0 ? round2((ptTotal / ptMax) * 100) : null;
  const ptWs = ptPs !== null ? round2(ptPs * weights.performance) : null;

  // Examinations (SA1/SA2/TE): this template sums the three raw scores
  // over their combined HPS, then takes one Percentage Score — confirmed
  // against the actual TERM sheet formulas (W/X columns), same pattern
  // as WW and PT above.
  const qaTotal = sumValid([scores.sa1, scores.sa2, scores.te]);
  const qaMax = sumValid([scores.sa1Hps, scores.sa2Hps, scores.teHps]);
  const qaPs = qaMax > 0 ? round2((qaTotal / qaMax) * 100) : null;
  const qaWs = qaPs !== null && weights.quarterly > 0 ? round2(qaPs * weights.quarterly) : null;

  // Initial Grade = sum of the (already-rounded) weighted scores.
  let initial: number | null = null;
  const parts: number[] = [];
  if (wwWs !== null) parts.push(wwWs);
  if (ptWs !== null) parts.push(ptWs);
  if (qaWs !== null) parts.push(qaWs);

  // Only compute if we have at least the components that have weight
  const hasRequired =
    (weights.written === 0 || wwWs !== null) &&
    (weights.performance === 0 || ptWs !== null) &&
    (weights.quarterly === 0 || qaWs !== null);

  if (hasRequired && parts.length > 0) {
    initial = round2(parts.reduce((a, b) => a + b, 0));
  }

  const transmuted = initial !== null ? transmute(initial) : null;
  const letter = transmuted !== null ? letterGrade(transmuted) : null;

  return {
    initial,
    transmuted,
    letter,
    wwTotal: wwMax > 0 ? wwTotal : null,
    wwPs,
    wwWs,
    ptTotal: ptMax > 0 ? ptTotal : null,
    ptPs,
    ptWs,
    qaTotal: qaMax > 0 ? qaTotal : null,
    qaPs,
    qaWs,
  };
}

export function emptyComponentScores(): ComponentScores {
  return {
    ww: [null, null, null, null, null],
    wwHps: [null, null, null, null, null],
    pt: [null, null, null],
    ptHps: [null, null, null],
    sa1: null,
    sa2: null,
    te: null,
    sa1Hps: null,
    sa2Hps: null,
    teHps: null,
  };
}
