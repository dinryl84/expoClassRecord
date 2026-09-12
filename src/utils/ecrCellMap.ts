/**
 * Cell map derived from the official SHS ECR template
 * (Class Record structure: INPUT DATA + TERM 1/2/3 + AVE).
 *
 * Inspected from real file layout — do not guess new coords.
 * TERM sheets pull learner names via formulas from INPUT DATA;
 * Total/PS/WS/Initial/Transmuted/Letter are also formulas.
 * We only WRITE input cells (school, names, HPS raw, score raw).
 */

export const ECR_MAP = {
  sheets: {
    input: 'INPUT DATA',
    term: (n: 1 | 2 | 3) => `TERM ${n}`,
    ave: 'AVE',
    helper: 'Helper(IMPORTANT!)',
  },

  /** INPUT DATA — school / section / subject (value cells only) */
  input: {
    region: 'F10',
    division: 'F11',
    schoolId: 'F13',
    schoolName: 'F14',
    schoolYear: 'F16',
    teacher: 'F22',
    track: 'F23',
    gradeLevel: 'F24',
    section: 'F25',
    subjectType: 'F26',
    subject: 'F28',
    otherElective: 'F30',

    /** Male: index col K, name col L, first row 11 */
    maleIndexCol: 'K',
    maleNameCol: 'L',
    maleStartRow: 11,
    /** Female: index col N, name col O, first row 11 */
    femaleIndexCol: 'N',
    femaleNameCol: 'O',
    femaleStartRow: 11,
    /** Max learner slots in INPUT DATA (template supports ~50 each) */
    maxLearners: 50,
  },

  /**
   * TERM 1/2/3 — same layout on each sheet.
   * Names in column B are formulas: ='INPUT DATA'!L11 etc. — DO NOT OVERWRITE.
   * Computed cols (Total/PS/WS/IG/TG/LG) are formulas — DO NOT OVERWRITE.
   */
  term: {
    hpsRow: 11,
    maleHeaderRow: 12,
    maleFirstDataRow: 13, // B13 = INPUT DATA!L11
    maleSlots: 50, // rows 13..62
    femaleHeaderRow: 63,
    femaleFirstDataRow: 64, // B64 = INPUT DATA!O11
    femaleSlots: 50, // rows 64..113

    /** Raw Written Works scores */
    wwCols: ['F', 'G', 'H', 'I', 'J'] as const,
    /** Raw Performance Task scores */
    ptCols: ['N', 'O', 'P'] as const,
    /** Raw Summative: SA1, SA2, TE */
    qaCols: ['T', 'U', 'V'] as const,

    // Formula columns — never write these on export:
    // K L M (WW total/PS/WS), Q R S (PT), W X Y (QA), Z AA AB (grades)
  },
} as const;

export type EcrMap = typeof ECR_MAP;

/** INPUT male name cell for 0-based index */
export function inputMaleNameCell(index0: number): string {
  return `${ECR_MAP.input.maleNameCol}${ECR_MAP.input.maleStartRow + index0}`;
}
export function inputMaleIndexCell(index0: number): string {
  return `${ECR_MAP.input.maleIndexCol}${ECR_MAP.input.maleStartRow + index0}`;
}
export function inputFemaleNameCell(index0: number): string {
  return `${ECR_MAP.input.femaleNameCol}${ECR_MAP.input.femaleStartRow + index0}`;
}
export function inputFemaleIndexCell(index0: number): string {
  return `${ECR_MAP.input.femaleIndexCol}${ECR_MAP.input.femaleStartRow + index0}`;
}

/** TERM data row for male 0-based index */
export function termMaleRow(index0: number): number {
  return ECR_MAP.term.maleFirstDataRow + index0;
}
export function termFemaleRow(index0: number): number {
  return ECR_MAP.term.femaleFirstDataRow + index0;
}
