/**
 * Descriptor labels and cutoffs match this app's ECR template's IFS formula
 * exactly (>=90/80/75/65/else -> A/B/C/D/E), which are DepEd Order No. 015,
 * s. 2026's Advancing / Benchmarking / Connecting / Developing / Emerging
 * bands, not the old DO 8, s. 2015 Outstanding/VS/S/FS/DNME bands.
 */
export const GRADE_META: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: 'Advancing', color: '#2f5e1f', bg: '#dfeed3' },
  B: { label: 'Benchmarking', color: '#1f5c66', bg: '#d9edef' },
  C: { label: 'Connecting', color: '#8a6d1f', bg: '#f4ecd0' },
  D: { label: 'Developing', color: '#a85a15', bg: '#f7e2cd' },
  E: { label: 'Emerging', color: '#9c2b2b', bg: '#f5dbdb' },
};

export const GRADE_ORDER = ['A', 'B', 'C', 'D', 'E'];
