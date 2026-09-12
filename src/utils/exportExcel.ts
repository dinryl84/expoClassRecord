import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';

import type { Section, Subject, SchoolInfo, ComponentScores, Learner } from '@/types';
import { emptyComponentScores } from './grades';
import { getSchoolInfo } from '@/db/repositories/schoolInfo';
import { getSetting, putSetting } from '@/db/repositories/settings';
import { getTermScoresForSubject } from '@/db/repositories/termScores';
import {
  ECR_MAP,
  inputMaleNameCell,
  inputMaleIndexCell,
  inputFemaleNameCell,
  inputFemaleIndexCell,
  termMaleRow,
  termFemaleRow,
  termNameCell,
} from './ecrCellMap';
import { loadZipFromBase64, zipToBase64, getSheetPathMap, findPath, setMany } from './ecrXlsxIO';
import type JSZip from 'jszip';

/** Yields to the event loop so the UI (e.g. the "Exporting…" spinner) can render between heavy steps. */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Loads the app's bundled blank ECR template (assets/ecr-template.xlsx)
 * as base64. Every export starts from this blank file so only the current
 * section's names and scores are written — never leftover data from a
 * previously imported filled class record.
 */
async function loadBundledTemplateBase64(): Promise<string> {
  const asset = Asset.fromModule(require('../../assets/ecr-template.xlsx'));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('Bundled ECR template could not be loaded.');
  }
  return FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
}

/** Result of assigning learners to a fixed number of template slots. */
interface SlotAssignment {
  slotByLearnerId: Map<string, number>;
  /** Learners that didn't fit because every slot (0..maxSlots-1) was taken. */
  overflow: Learner[];
}

/**
 * Assign a stable 0-based Excel slot to every learner.
 * - Learners that already have a `slot` (from import) keep it.
 * - Learners created in-app get the lowest free slots.
 * This keeps names aligned with the fixed TERM-sheet formulas.
 * Learners beyond `maxSlots` are reported back as `overflow` instead of
 * being silently dropped.
 */
function assignSlots(learners: Learner[], maxSlots: number): SlotAssignment {
  const used = new Set<number>();
  const slotByLearnerId = new Map<string, number>();

  for (const l of learners) {
    if (l.slot != null && l.slot >= 0 && l.slot < maxSlots && !used.has(l.slot)) {
      used.add(l.slot);
      slotByLearnerId.set(l.id, l.slot);
    }
  }

  const overflow: Learner[] = [];
  let next = 0;
  for (const l of learners) {
    if (slotByLearnerId.has(l.id)) continue;
    while (next < maxSlots && used.has(next)) next++;
    if (next >= maxSlots) {
      overflow.push(l);
      continue;
    }
    used.add(next);
    slotByLearnerId.set(l.id, next);
    next++;
  }
  return { slotByLearnerId, overflow };
}

function buildInputCells(
  school: SchoolInfo,
  section: Section,
  subject: Subject,
  males: Learner[],
  females: Learner[],
  maleSlotByLearnerId: Map<string, number>,
  femaleSlotByLearnerId: Map<string, number>
): Record<string, string | number | null | undefined> {
  const I = ECR_MAP.input;
  const cells: Record<string, string | number | null | undefined> = {
    [I.region]: school.region || null,
    [I.division]: school.division || null,
    [I.schoolId]: school.schoolId || null,
    [I.schoolName]: school.schoolName || null,
    [I.schoolYear]: school.schoolYear || null,
    [I.teacher]: school.teacher || null,
    [I.track]: school.track || null,
    [I.gradeLevel]: section.gradeLevel,
    [I.section]: section.name,
    [I.subjectType]: subject.subjectType,
    [I.subject]: subject.name,
  };
  if (subject.otherElectiveName) cells[I.otherElective] = subject.otherElectiveName;

  for (let i = 0; i < I.maxLearners; i++) {
    cells[inputMaleIndexCell(i)] = null;
    cells[inputMaleNameCell(i)] = null;
    cells[inputFemaleIndexCell(i)] = null;
    cells[inputFemaleNameCell(i)] = null;
  }

  for (const l of males) {
    const slot = maleSlotByLearnerId.get(l.id);
    if (slot == null) continue;
    cells[inputMaleIndexCell(slot)] = slot + 1;
    cells[inputMaleNameCell(slot)] = l.name;
  }
  for (const l of females) {
    const slot = femaleSlotByLearnerId.get(l.id);
    if (slot == null) continue;
    cells[inputFemaleIndexCell(slot)] = slot + 1;
    cells[inputFemaleNameCell(slot)] = l.name;
  }
  return cells;
}

function buildTermRawCells(
  males: Learner[],
  females: Learner[],
  scores: Record<string, ComponentScores>,
  maleSlotByLearnerId: Map<string, number>,
  femaleSlotByLearnerId: Map<string, number>
): Record<string, string | number | null | undefined> {
  const T = ECR_MAP.term;
  const cells: Record<string, string | number | null | undefined> = {};
  const hps = (scores['__hps__'] as unknown as ComponentScores) || emptyComponentScores();

  T.wwCols.forEach((col, i) => { cells[`${col}${T.hpsRow}`] = hps.ww[i] ?? null; });
  T.ptCols.forEach((col, i) => { cells[`${col}${T.hpsRow}`] = hps.pt[i] ?? null; });
  cells[`${T.qaCols[0]}${T.hpsRow}`] = hps.sa1;
  cells[`${T.qaCols[1]}${T.hpsRow}`] = hps.sa2;
  cells[`${T.qaCols[2]}${T.hpsRow}`] = hps.te;

  const clearRow = (row: number) => {
    T.wwCols.forEach((col) => { cells[`${col}${row}`] = null; });
    T.ptCols.forEach((col) => { cells[`${col}${row}`] = null; });
    T.qaCols.forEach((col) => { cells[`${col}${row}`] = null; });
    // Column B carries a formula (or a stale typed name) in the base file —
    // clear it so a slot with no learner can't keep the old class's name.
    cells[termNameCell(row)] = null;
  };
  const writeRow = (row: number, sc: ComponentScores, name: string) => {
    T.wwCols.forEach((col, i) => { cells[`${col}${row}`] = sc.ww[i] ?? null; });
    T.ptCols.forEach((col, i) => { cells[`${col}${row}`] = sc.pt[i] ?? null; });
    cells[`${T.qaCols[0]}${row}`] = sc.sa1;
    cells[`${T.qaCols[1]}${row}`] = sc.sa2;
    cells[`${T.qaCols[2]}${row}`] = sc.te;
    // Write the name explicitly instead of trusting the template's formula
    // (whose cached result belongs to whoever last saved the base file).
    cells[termNameCell(row)] = name;
  };

  for (let i = 0; i < T.maleSlots; i++) clearRow(termMaleRow(i));
  for (let i = 0; i < T.femaleSlots; i++) clearRow(termFemaleRow(i));

  for (const l of males) {
    const slot = maleSlotByLearnerId.get(l.id);
    if (slot == null) continue;
    writeRow(termMaleRow(slot), scores[l.id] || emptyComponentScores(), l.name);
  }
  for (const l of females) {
    const slot = femaleSlotByLearnerId.get(l.id);
    if (slot == null) continue;
    writeRow(termFemaleRow(slot), scores[l.id] || emptyComponentScores(), l.name);
  }

  return cells;
}

/**
 * TERM-sheet header cells (region/division/school/teacher/track + grade &
 * section + subject). In the base file these are formulas that pull from
 * INPUT DATA and carry the *cached* result of whoever last saved it — which
 * may be a completely different class. We overwrite them with plain values
 * so the exported file can never display another class's header.
 */
function buildTermHeaderCells(
  school: SchoolInfo,
  section: Section,
  subject: Subject
): Record<string, string | number | null | undefined> {
  const gradeSection = `${section.gradeLevel} - ${section.name}`;
  return {
    G4: school.region || null, // REGION
    R4: school.division || null, // DIVISION
    G5: school.schoolName || null, // SCHOOL NAME
    R5: school.schoolId || null, // SCHOOL ID
    Z5: school.schoolYear || null, // SCHOOL YEAR
    K7: gradeSection, // GRADE LEVEL AND SECTION
    S7: school.teacher || null, // TEACHER
    Z7: subject.otherElectiveName || subject.name, // SUBJECT (elective wins)
    S8: school.track || null, // TRACK
    Z8: subject.subjectType, // SUBJECT TYPE
  };
}

/** Same idea as buildTermHeaderCells, for the Final Grades (AVE) sheet. */
function buildAveHeaderCells(
  school: SchoolInfo,
  section: Section,
  subject: Subject
): Record<string, string | number | null | undefined> {
  const gradeSection = `${section.gradeLevel} - ${section.name}`;
  return {
    D5: school.region || null, // REGION
    P5: school.division || null, // DIVISION
    AB5: school.schoolId || null, // SCHOOL ID
    D6: school.schoolName || null, // SCHOOL NAME
    AB6: school.schoolYear || null, // SCHOOL YEAR
    N9: gradeSection, // GRADE & SECTION
    Z9: subject.otherElectiveName || subject.name, // SUBJECT (elective wins)
    I10: school.teacher || null, // TEACHER
    Z10: subject.subjectType, // SUBJECT TYPE
  };
}

/**
 * AVE lists the full roster in column B on the SAME row grid as the TERM
 * sheets. It was never rewritten before, so a base file from another class
 * kept its old roster here — the "names from the wrong class" symptom.
 * Rewrite it like the TERM name column: clear every slot, then write the
 * current learners (reusing the same slot assignment as INPUT/TERM so the
 * three sheets stay aligned).
 */
function buildAveNameCells(
  males: Learner[],
  females: Learner[],
  maleSlotByLearnerId: Map<string, number>,
  femaleSlotByLearnerId: Map<string, number>
): Record<string, string | number | null | undefined> {
  const T = ECR_MAP.term;
  const cells: Record<string, string | number | null | undefined> = {};

  for (let i = 0; i < T.maleSlots; i++) cells[termNameCell(termMaleRow(i))] = null;
  for (let i = 0; i < T.femaleSlots; i++) cells[termNameCell(termFemaleRow(i))] = null;

  for (const l of males) {
    const slot = maleSlotByLearnerId.get(l.id);
    if (slot == null) continue;
    cells[termNameCell(termMaleRow(slot))] = l.name;
  }
  for (const l of females) {
    const slot = femaleSlotByLearnerId.get(l.id);
    if (slot == null) continue;
    cells[termNameCell(termFemaleRow(slot))] = l.name;
  }
  return cells;
}

/**
 * Force Excel to recalculate every formula when the file opens. Without this,
 * formula cells (headers, totals, computed grades) show the cached values
 * baked into the base file — which belong to the class the base was created
 * for, not the one being exported.
 */
async function forceRecalcOnOpen(zip: JSZip): Promise<void> {
  try {
    // Drop the calc chain so nothing can short-circuit a full recalc.
    zip.remove('xl/calcChain.xml');
  } catch {
    /* older JSZip API — ignore */
  }
  const wbFile = zip.file('xl/workbook.xml');
  if (!wbFile) return;
  let xml = await wbFile.async('string');
  if (/<calcPr/i.test(xml)) {
    xml = xml.replace(/<calcPr(\s[^>]*?)(\/?)>/i, (tag: string, attrs: string, slash: string) => {
      if (/\bfullCalcOnLoad\b/i.test(attrs)) return tag;
      return `<calcPr${attrs} fullCalcOnLoad="1"${slash}>`;
    });
  } else {
    xml = xml.replace(/<\/workbook>/i, '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
  }
  zip.file('xl/workbook.xml', xml);
}

export interface ExportOptions {
  section: Section;
  subject: Subject;
}

export interface ExportResult {
  fileUri: string;
  shared: boolean;
  /** Learners that didn't fit in the template's 50-per-gender limit and were left out of the export. */
  overflowLearners: Learner[];
}

export interface SaveToFolderResult {
  /** SAF content:// URI of the file that was written into the chosen folder, or null if the user cancelled the folder picker. */
  savedUri: string | null;
  overflowLearners: Learner[];
}

interface BuiltClassRecord {
  base64: string;
  safeName: string;
  overflowLearners: Learner[];
}

/**
 * Loads the template, fills in every cell, and returns the finished workbook
 * as base64 — shared by both the "share sheet" export and the "save to
 * folder" export below, since everything up to writing the bytes somewhere
 * is identical either way.
 *
 * Exported as a seam for the export verification harness; normal callers go
 * through exportClassRecord / saveClassRecordToFolder.
 */
export async function buildClassRecordFile({ section, subject }: ExportOptions): Promise<BuiltClassRecord> {
  // Always start from the bundled blank ECR template.
  // A previously imported *filled* class record may still be stored as
  // "ecr-template" in the DB; using it leaks other sections' names/scores
  // into the export (e.g. Savvy export showing Valor data). Writing only
  // on top of a blank template guarantees the file contains only this
  // section + subject.
  const templateBase64 = await loadBundledTemplateBase64();

  const zip = await loadZipFromBase64(templateBase64);
  const pathMap = await getSheetPathMap(zip);

  const school = getSchoolInfo();
  const row = getTermScoresForSubject(subject.id);
  const terms = row?.terms || [];
  const getTermScores = (term: 1 | 2 | 3) =>
    (terms.find((t) => t.term === term)?.scores as unknown as Record<string, ComponentScores>) || {};

  const males = section.learners.filter((l) => l.gender === 'Male').sort((a, b) => a.order - b.order);
  const females = section.learners.filter((l) => l.gender === 'Female').sort((a, b) => a.order - b.order);

  // The INPUT and TERM sheets both have the same 50-per-gender slot limit,
  // so a single assignment is shared by both — anyone who doesn't fit is
  // surfaced to the caller instead of silently left out of the file.
  const maleAssignment = assignSlots(males, ECR_MAP.input.maxLearners);
  const femaleAssignment = assignSlots(females, ECR_MAP.input.maxLearners);
  const overflowLearners = [...maleAssignment.overflow, ...femaleAssignment.overflow];

  const inputPath = findPath(pathMap, ECR_MAP.sheets.input, 'INPUT');
  if (!inputPath || !zip.file(inputPath)) {
    throw new Error('INPUT DATA sheet not found inside template.');
  }
  {
    let xml = await zip.file(inputPath)!.async('string');
    xml = setMany(
      xml,
      buildInputCells(school, section, subject, males, females, maleAssignment.slotByLearnerId, femaleAssignment.slotByLearnerId)
    );
    zip.file(inputPath, xml);
  }
  await yieldToUI();

  for (const termNum of [1, 2, 3] as const) {
    const termPath = findPath(pathMap, ECR_MAP.sheets.term(termNum));
    if (!termPath || !zip.file(termPath)) {
      throw new Error(`${ECR_MAP.sheets.term(termNum)} sheet not found inside template.`);
    }
    let xml = await zip.file(termPath)!.async('string');
    xml = setMany(xml, {
      // Header cells first so a stale cached heading can never survive.
      ...buildTermHeaderCells(school, section, subject),
      ...buildTermRawCells(males, females, getTermScores(termNum), maleAssignment.slotByLearnerId, femaleAssignment.slotByLearnerId),
    });
    zip.file(termPath, xml);
    await yieldToUI();
  }

  // AVE (Final Grades) has its own header + roster that the base file filled
  // with another class's data — scrub both.
  const avePath = findPath(pathMap, ECR_MAP.sheets.ave, 'AVE');
  if (avePath && zip.file(avePath)) {
    let xml = await zip.file(avePath)!.async('string');
    xml = setMany(xml, {
      ...buildAveHeaderCells(school, section, subject),
      ...buildAveNameCells(males, females, maleAssignment.slotByLearnerId, femaleAssignment.slotByLearnerId),
    });
    zip.file(avePath, xml);
    await yieldToUI();
  }

  // Force Excel to recalculate on open so formula cells (headers, totals,
  // computed grades) don't display the base file's cached results.
  await forceRecalcOnOpen(zip);

  const base64 = await zipToBase64(zip);
  const safeName = `Class Record - ${section.name} - ${subject.name}`.replace(/[\\/:*?"<>|]/g, '_');
  return { base64, safeName, overflowLearners };
}

/**
 * Exports one subject's class record and opens the OS share sheet so the
 * teacher can send it to Drive, email, etc.
 */
export async function exportClassRecord({ section, subject }: ExportOptions): Promise<ExportResult> {
  const { base64, safeName, overflowLearners } = await buildClassRecordFile({ section, subject });

  const fileUri = `${FileSystem.documentDirectory}${safeName}.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Save Class Record',
    });
    shared = true;
  }

  return { fileUri, shared, overflowLearners };
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Exports the class record straight into a folder the teacher picks (e.g.
 * Downloads), using Android's Storage Access Framework — no share sheet, no
 * app picker. The user is prompted to choose a folder the first time; after
 * that we reuse the granted folder permission for future saves.
 */
export async function saveClassRecordToFolder({ section, subject }: ExportOptions): Promise<SaveToFolderResult> {
  const SAF = (FileSystem as any).StorageAccessFramework;
  if (!SAF) {
    throw new Error('Saving directly to a folder is only supported on Android.');
  }

  const { base64, safeName, overflowLearners } = await buildClassRecordFile({ section, subject });

  let directoryUri: string | null = null;
  try {
    directoryUri = await getSetting('exportFolderUri');
  } catch {
    directoryUri = null;
  }

  const requestNewFolder = async (): Promise<string | null> => {
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    try {
      await putSetting('exportFolderUri', perm.directoryUri);
    } catch {
      // Non-fatal — we just won't remember the folder for next time.
    }
    return perm.directoryUri as string;
  };

  if (!directoryUri) {
    directoryUri = await requestNewFolder();
  }
  if (!directoryUri) {
    return { savedUri: null, overflowLearners };
  }

  const write = async (dirUri: string) => {
    const fileUri = await SAF.createFileAsync(dirUri, safeName, XLSX_MIME);
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return fileUri as string;
  };

  try {
    const savedUri = await write(directoryUri);
    return { savedUri, overflowLearners };
  } catch (e) {
    // The remembered folder permission may have been revoked (e.g. the
    // teacher cleared storage permissions) — ask for a fresh one and retry
    // once before giving up.
    const freshUri = await requestNewFolder();
    if (!freshUri) return { savedUri: null, overflowLearners };
    const savedUri = await write(freshUri);
    return { savedUri, overflowLearners };
  }
}
