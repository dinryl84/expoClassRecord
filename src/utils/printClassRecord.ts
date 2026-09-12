import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ComponentScores, Learner, SchoolInfo, Section, Subject } from '@/types';
import { calculateGrade, emptyComponentScores } from './grades';
import { getSchoolInfo } from '@/db/repositories/schoolInfo';
import { getTermScoresForSubject } from '@/db/repositories/termScores';

function gradeFor(
  learnerId: string,
  term: 1 | 2 | 3,
  termScores: Record<1 | 2 | 3, Record<string, ComponentScores>>,
  subjectType: Subject['subjectType']
) {
  const scores = termScores[term] || {};
  const hps = (scores['__hps__'] as unknown as ComponentScores) || emptyComponentScores();
  const raw = scores[learnerId] || emptyComponentScores();
  return calculateGrade(
    { ...raw, wwHps: hps.ww, ptHps: hps.pt, sa1Hps: hps.sa1, sa2Hps: hps.sa2, teHps: hps.te },
    subjectType
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTable(
  list: Learner[],
  label: 'MALE' | 'FEMALE',
  termScores: Record<1 | 2 | 3, Record<string, ComponentScores>>,
  subjectType: Subject['subjectType']
): string {
  if (list.length === 0) return '';
  const headerColor = label === 'MALE' ? '#8B2626' : '#EF6905';

  const rows = list
    .map((l) => {
      const g1 = gradeFor(l.id, 1, termScores, subjectType);
      const g2 = gradeFor(l.id, 2, termScores, subjectType);
      const g3 = gradeFor(l.id, 3, termScores, subjectType);
      const vals = [g1.transmuted, g2.transmuted, g3.transmuted].filter((v): v is number => v != null);
      const avg = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
      const remarkColor = avg != null && avg >= 75 ? '#486C2F' : '#8B2626';
      const remarkText = avg != null ? (avg >= 75 ? 'PASSED' : 'FAILED') : '—';
      return `
        <tr>
          <td class="cell">${l.order}</td>
          <td class="cell name">${escapeHtml(l.name)}</td>
          <td class="cell center">${g1.transmuted ?? '—'}</td>
          <td class="cell center">${g2.transmuted ?? '—'}</td>
          <td class="cell center">${g3.transmuted ?? '—'}</td>
          <td class="cell center avg">${avg ?? '—'}</td>
          <td class="cell center" style="color:${remarkColor}; font-weight:600;">${remarkText}</td>
        </tr>`;
    })
    .join('');

  return `
    <div style="margin-bottom:24px;">
      <h3 style="background:${headerColor}; color:white; padding:6px 10px; font-size:13px; margin:0;">
        ${label} (${list.length})
      </h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#F1E5A1;">
            <th class="head" style="text-align:left;">#</th>
            <th class="head" style="text-align:left;">Name</th>
            <th class="head">T1</th>
            <th class="head">T2</th>
            <th class="head">T3</th>
            <th class="head">Ave</th>
            <th class="head">Remarks</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function buildClassRecordHtml(section: Section, subject: Subject, school: SchoolInfo, termScores: Record<1 | 2 | 3, Record<string, ComponentScores>>): string {
  const males = section.learners.filter((l) => l.gender === 'Male').sort((a, b) => a.order - b.order);
  const females = section.learners.filter((l) => l.gender === 'Female').sort((a, b) => a.order - b.order);

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #2A2118; }
          .head { padding: 6px; border: 1px solid #ccc; }
          .cell { padding: 5px; border: 1px solid #ddd; }
          .cell.name { text-align: left; }
          .cell.center { text-align: center; }
          .cell.avg { font-weight: 700; }
        </style>
      </head>
      <body>
        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:16px; font-weight:700;">Strengthened Senior High School Class Record</div>
          <div style="font-size:12px; color:#666;">(Pursuant to DepEd Order No. 015, s. 2026)</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px; margin-bottom:16px;">
          <div><strong>School:</strong> ${escapeHtml(school.schoolName)}</div>
          <div><strong>School ID:</strong> ${escapeHtml(school.schoolId)}</div>
          <div><strong>Region:</strong> ${escapeHtml(school.region)}</div>
          <div><strong>Division:</strong> ${escapeHtml(school.division)}</div>
          <div><strong>Teacher:</strong> ${escapeHtml(school.teacher)}</div>
          <div><strong>SY:</strong> ${escapeHtml(school.schoolYear)}</div>
          <div><strong>Grade &amp; Section:</strong> ${section.gradeLevel} - ${escapeHtml(section.name)}</div>
          <div><strong>Subject:</strong> ${escapeHtml(subject.name)}</div>
        </div>
        ${renderTable(males, 'MALE', termScores, subject.subjectType)}
        ${renderTable(females, 'FEMALE', termScores, subject.subjectType)}
      </body>
    </html>`;
}

function loadTermScoresMap(subjectId: string): Record<1 | 2 | 3, Record<string, ComponentScores>> {
  const row = getTermScoresForSubject(subjectId);
  const map: Record<1 | 2 | 3, Record<string, ComponentScores>> = { 1: {}, 2: {}, 3: {} };
  for (const t of row?.terms || []) {
    map[t.term] = (t.scores as unknown as Record<string, ComponentScores>) || {};
  }
  return map;
}

/** Opens the native print dialog (which includes "Save as PDF" as a printer option on Android). */
export async function printClassRecord(section: Section, subject: Subject): Promise<void> {
  const school = getSchoolInfo();
  const termScores = loadTermScoresMap(subject.id);
  const html = buildClassRecordHtml(section, subject, school, termScores);
  await Print.printAsync({ html });
}

/** Generates a PDF file and opens the share sheet so it can be saved or sent elsewhere. */
export async function shareClassRecordPdf(section: Section, subject: Subject): Promise<{ uri: string }> {
  const school = getSchoolInfo();
  const termScores = loadTermScoresMap(subject.id);
  const html = buildClassRecordHtml(section, subject, school, termScores);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Class Record PDF' });
  }
  return { uri };
}
