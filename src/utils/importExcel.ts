import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import type { Section, Subject, SubjectType, ComponentScores, Learner, SchoolInfo, TermScores } from '@/types';
import { emptyComponentScores } from './grades';
import { uuid } from './id';
import { getAllSections, getSectionById, putSection } from '@/db/repositories/sections';
import { getSchoolInfo, putSchoolInfo, defaultSchoolInfo } from '@/db/repositories/schoolInfo';
import { getTermScoresForSubject, putTermScores } from '@/db/repositories/termScores';
import { putTemplate } from '@/db/repositories/templates';
import { reconcileLearners } from './learnerMatch';
import { ECR_MAP, inputMaleNameCell, inputFemaleNameCell } from './ecrCellMap';
import { loadZipFromBase64, getSheetPathMap, findPath, readSharedStrings, getCellValue } from './ecrXlsxIO';

function num(val: string | number | null): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function str(val: string | number | null): string {
  if (val == null) return '';
  return String(val).trim();
}

function isValidName(name: string): boolean {
  if (!name || name === '0') return false;
  if (/^(MALE|FEMALE|HIGHEST|LEARNER|NAME|#|NO\.?)$/i.test(name)) return false;
  return name.length >= 2;
}

const SUBJECT_TYPES: SubjectType[] = [
  'Core Subject (All Tracks)',
  'Academic Elective (All Other Electives)',
  'Academic Elective (Field Experience / Exposure, and Sports and Arts)',
  'TechPro Elective (All Other Electives)',
  'TechPro Elective (Work Immersion)',
];

function matchSubjectType(raw: string): SubjectType {
  const t = raw.toLowerCase();
  for (const st of SUBJECT_TYPES) if (st.toLowerCase() === t) return st;
  if (t.includes('work immersion')) return 'TechPro Elective (Work Immersion)';
  if (t.includes('techpro') || t.includes('tech-voc') || t.includes('tvl')) return 'TechPro Elective (All Other Electives)';
  if (t.includes('field experience') || t.includes('sports and arts'))
    return 'Academic Elective (Field Experience / Exposure, and Sports and Arts)';
  if (t.includes('elective')) return 'Academic Elective (All Other Electives)';
  return 'Core Subject (All Tracks)';
}

export interface FullImportResult {
  sectionId: string;
  subjectId: string;
  learnersCount: number;
  scoresCount: number;
  message: string;
}

/** A loaded workbook, ready for cell lookups by sheet name + ref (e.g. "F10"). */
interface LoadedWorkbook {
  getCell(sheetName: string, ref: string): string | number | null;
  hasSheet(sheetName: string): boolean;
}

async function loadWorkbook(base64: string): Promise<LoadedWorkbook> {
  const zip = await loadZipFromBase64(base64);
  const pathMap = await getSheetPathMap(zip);
  const sharedStrings = await readSharedStrings(zip);
  const xmlCache = new Map<string, string>();

  const resolvePath = (sheetName: string): string | null => findPath(pathMap, sheetName);

  const getXml = async (path: string): Promise<string> => {
    if (xmlCache.has(path)) return xmlCache.get(path)!;
    const file = zip.file(path);
    const xml = file ? await file.async('string') : '';
    xmlCache.set(path, xml);
    return xml;
  };

  // Pre-load every sheet's XML up front (small files, simpler than async-per-cell).
  for (const path of Object.values(pathMap)) {
    await getXml(path);
  }

  return {
    hasSheet: (sheetName) => resolvePath(sheetName) !== null,
    getCell: (sheetName, ref) => {
      const path = resolvePath(sheetName);
      if (!path) return null;
      const xml = xmlCache.get(path);
      if (!xml) return null;
      return getCellValue(xml, ref, sharedStrings);
    },
  };
}

async function runImport(base64: string, fileName: string): Promise<FullImportResult> {
  const wb = await loadWorkbook(base64);
  const I = ECR_MAP.input;
  const T = ECR_MAP.term;

  if (!wb.hasSheet(ECR_MAP.sheets.input)) {
    throw new Error(`Sheet "${ECR_MAP.sheets.input}" not found. Use a valid SHS ECR Excel file.`);
  }
  const inputSheet = ECR_MAP.sheets.input;
  const cell = (ref: string) => wb.getCell(inputSheet, ref);

  const currentSchool = getSchoolInfo();
  const school: SchoolInfo = {
    ...currentSchool,
    region: str(cell(I.region)) || defaultSchoolInfo.region,
    division: str(cell(I.division)) || defaultSchoolInfo.division,
    schoolId: str(cell(I.schoolId)) || defaultSchoolInfo.schoolId,
    schoolName: str(cell(I.schoolName)) || defaultSchoolInfo.schoolName,
    schoolYear: str(cell(I.schoolYear)) || defaultSchoolInfo.schoolYear,
    teacher: str(cell(I.teacher)) || currentSchool.teacher || '',
    track: str(cell(I.track)) || 'ACADEMIC',
  };
  putSchoolInfo(school);

  const gradeRaw = str(cell(I.gradeLevel));
  const gradeLevel = (gradeRaw === '12' ? 12 : 11) as 11 | 12;
  const sectionName = (str(cell(I.section)) || 'SECTION').toUpperCase();
  const subjectType = matchSubjectType(str(cell(I.subjectType)));
  const subjectName = str(cell(I.subject)) || 'Subject';
  const otherElective = str(cell(I.otherElective));

  let parsedLearners: Learner[] = [];
  let mOrder = 1;
  let fOrder = 1;

  for (let i = 0; i < I.maxLearners; i++) {
    const m = str(wb.getCell(inputSheet, inputMaleNameCell(i)));
    if (isValidName(m)) {
      parsedLearners.push({ id: uuid(), name: m.toUpperCase(), gender: 'Male', order: mOrder++, slot: i });
    }
    const f = str(wb.getCell(inputSheet, inputFemaleNameCell(i)));
    if (isValidName(f)) {
      parsedLearners.push({ id: uuid(), name: f.toUpperCase(), gender: 'Female', order: fOrder++, slot: i });
    }
  }

  const allSections = getAllSections();
  let section = allSections.find((s) => s.name.toUpperCase() === sectionName && s.gradeLevel === gradeLevel);

  // Re-importing an existing section must not mint new IDs for students who
  // are already on the roster — attendance, notes, and every other subject's
  // scores are keyed by learner id. Only genuinely new names get a new id.
  const learners: Learner[] = section ? reconcileLearners(section.learners, parsedLearners) : parsedLearners;

  const maleSlots: { slot: number; learner: Learner }[] = [];
  const femaleSlots: { slot: number; learner: Learner }[] = [];
  for (const l of learners) {
    if (l.slot == null) continue;
    if (l.gender === 'Male') maleSlots.push({ slot: l.slot, learner: l });
    else femaleSlots.push({ slot: l.slot, learner: l });
  }

  const subjectId = uuid();
  const subject: Subject = {
    id: subjectId,
    name: subjectName,
    subjectType,
    otherElectiveName: otherElective || undefined,
    sectionId: '',
  };

  if (section) {
    const otherSubjects = section.subjects.filter((s) => s.name.toLowerCase() !== subjectName.toLowerCase());
    subject.sectionId = section.id;
    section = { ...section, learners, subjects: [...otherSubjects, subject] };
  } else {
    const sectionId = uuid();
    subject.sectionId = sectionId;
    section = { id: sectionId, name: sectionName, gradeLevel, learners, subjects: [subject] };
  }
  putSection(section);

  let scoresCount = 0;
  const terms: TermScores[] = [];

  for (const termNum of [1, 2, 3] as const) {
    const sheetName = ECR_MAP.sheets.term(termNum);
    if (!wb.hasSheet(sheetName)) continue;

    const scores: Record<string, ComponentScores> = {};
    const hps = emptyComponentScores();
    T.wwCols.forEach((col, i) => { hps.ww[i] = num(wb.getCell(sheetName, `${col}${T.hpsRow}`)); });
    T.ptCols.forEach((col, i) => { hps.pt[i] = num(wb.getCell(sheetName, `${col}${T.hpsRow}`)); });
    hps.sa1 = num(wb.getCell(sheetName, `${T.qaCols[0]}${T.hpsRow}`));
    hps.sa2 = num(wb.getCell(sheetName, `${T.qaCols[1]}${T.hpsRow}`));
    hps.te = num(wb.getCell(sheetName, `${T.qaCols[2]}${T.hpsRow}`));

    const readRow = (row: number, learner: Learner) => {
      const sc = emptyComponentScores();
      T.wwCols.forEach((col, i) => { sc.ww[i] = num(wb.getCell(sheetName, `${col}${row}`)); });
      T.ptCols.forEach((col, i) => { sc.pt[i] = num(wb.getCell(sheetName, `${col}${row}`)); });
      sc.sa1 = num(wb.getCell(sheetName, `${T.qaCols[0]}${row}`));
      sc.sa2 = num(wb.getCell(sheetName, `${T.qaCols[1]}${row}`));
      sc.te = num(wb.getCell(sheetName, `${T.qaCols[2]}${row}`));
      const hasAny = sc.ww.some((v) => v != null) || sc.pt.some((v) => v != null) || sc.sa1 != null || sc.sa2 != null || sc.te != null;
      if (hasAny) {
        scores[learner.id] = sc;
        scoresCount++;
      }
    };

    maleSlots.forEach(({ slot, learner }) => { if (slot < T.maleSlots) readRow(T.maleFirstDataRow + slot, learner); });
    femaleSlots.forEach(({ slot, learner }) => { if (slot < T.femaleSlots) readRow(T.femaleFirstDataRow + slot, learner); });

    (scores as any)['__hps__'] = hps;
    terms.push({ term: termNum, scores });
  }

  const existing = getTermScoresForSubject(subject.id);
  putTermScores({ id: existing?.id || `${subject.id}-scores`, subjectId: subject.id, terms, baselineTerms: existing?.baselineTerms });

  return {
    sectionId: section.id,
    subjectId: subject.id,
    learnersCount: learners.length,
    scoresCount,
    message: `Imported: ${sectionName} (G${gradeLevel}), ${subjectName}, ${learners.length} learners, ${scoresCount} score rows.`,
  };
}

const XLSX_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

async function pickXlsxBase64(): Promise<{ base64: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: XLSX_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, name: asset.name || 'class-record.xlsx' };
}

/**
 * Opens the document picker and imports section / learners / scores into the app.
 * Does NOT change the export template.
 * Returns null if the user cancelled the picker.
 */
export async function pickAndImportClassRecord(): Promise<FullImportResult | null> {
  const picked = await pickXlsxBase64();
  if (!picked) return null;
  return runImport(picked.base64, picked.name);
}

export interface SetTemplateResult {
  fileName: string;
  message: string;
}

/**
 * Opens the document picker and saves the chosen file as the reusable export
 * template only. Does NOT import any section, learners, or scores.
 * Prefer a blank official DepEd ECR so exports stay clean across sections.
 * Returns null if the user cancelled the picker.
 */
export async function pickAndSetExportTemplate(): Promise<SetTemplateResult | null> {
  const picked = await pickXlsxBase64();
  if (!picked) return null;

  // Light validation: make sure this looks like an ECR (has INPUT DATA sheet).
  const zip = await loadZipFromBase64(picked.base64);
  const pathMap = await getSheetPathMap(zip);
  const inputPath = findPath(pathMap, ECR_MAP.sheets.input, 'INPUT');
  if (!inputPath) {
    throw new Error(
      'That file does not look like a DepEd SHS Electronic Class Record (missing INPUT DATA sheet).'
    );
  }

  putTemplate({
    id: 'ecr-template',
    name: picked.name,
    data: picked.base64,
    updatedAt: Date.now(),
  });

  return {
    fileName: picked.name,
    message: `Export template set to "${picked.name}". Future exports will use this file's layout and formulas. Importing class records no longer changes this template.`,
  };
}
