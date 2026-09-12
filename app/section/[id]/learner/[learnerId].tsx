import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/Header';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { StudentNotes } from '@/components/StudentNotes';
import { Card } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
import { getSectionById } from '@/db/repositories/sections';
import { getTermScoresForSubject } from '@/db/repositories/termScores';
import { getSchoolInfo } from '@/db/repositories/schoolInfo';
import { calculateGrade, emptyComponentScores, getWeights } from '@/utils/grades';
import { GRADE_META } from '@/utils/gradeMeta';
import {
  getLearnerAttendanceTotals,
  getLearnerAttendanceMonths,
  monthLabel,
  type AttendancePeriodFilter,
} from '@/utils/attendance';
import type {
  CalculatedGrade,
  ComponentScores,
  Learner,
  Section,
  Subject,
} from '@/types';

type Term = 1 | 2 | 3;

function ScoreCell({
  score,
  hps,
}: {
  score: number | null | undefined;
  hps: number | null | undefined;
}) {
  if (score == null && hps == null) {
    return <Text style={{ color: colors.textMuted }}>—</Text>;
  }
  return (
    <Text style={styles.scoreCellText}>
      <Text style={{ fontWeight: '700' }}>{score != null ? score : '—'}</Text>
      {hps != null ? <Text style={{ color: colors.textMuted, fontSize: 10 }}> /{hps}</Text> : null}
    </Text>
  );
}

export default function StudentReport() {
  const { id, learnerId: initialLearnerId } = useLocalSearchParams<{
    id: string;
    learnerId: string;
  }>();
  const section: Section | null = id ? getSectionById(id) : null;

  const roster: Learner[] = useMemo(() => {
    if (!section) return [];
    const males = section.learners
      .filter((l) => l.gender === 'Male')
      .sort((a, b) => a.order - b.order);
    const females = section.learners
      .filter((l) => l.gender === 'Female')
      .sort((a, b) => a.order - b.order);
    return [...males, ...females];
  }, [section]);

  const [learnerId, setLearnerId] = useState(initialLearnerId ?? roster[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [attMode, setAttMode] = useState<'all' | '1' | '2' | '3'>('all');
  const [attMonth, setAttMonth] = useState<{ year: number; month: number } | null>(null);

  const schoolInfo = getSchoolInfo();
  const termDates = schoolInfo.termDates ?? {};

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (l) => l.name.toLowerCase().includes(q) || String(l.order).includes(q)
    );
  }, [roster, search]);

  const learner = roster.find((l) => l.id === learnerId) ?? roster[0];
  const currentIndex = roster.findIndex((l) => l.id === learner?.id);

  const goPrev = () => {
    if (currentIndex > 0) setLearnerId(roster[currentIndex - 1].id);
  };
  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < roster.length - 1) {
      setLearnerId(roster[currentIndex + 1].id);
    }
  };

  const subjectRows = useMemo(() => {
    if (!section || !learner) return [];
    return section.subjects.map((subject) => {
      const row = getTermScoresForSubject(subject.id);
      const grades: (CalculatedGrade | null)[] = [1, 2, 3].map((term) => {
        const termData = row?.terms.find((t) => t.term === term);
        if (!termData?.scores) return null;
        const raw = termData.scores[learner.id] as ComponentScores | undefined;
        const hpsRow = termData.scores['__hps__'] as unknown as ComponentScores | undefined;
        if (!raw && !hpsRow) return null;
        const scores: ComponentScores = {
          ...emptyComponentScores(),
          ...(raw || {}),
          wwHps: hpsRow?.ww ?? [],
          ptHps: hpsRow?.pt ?? [],
          sa1Hps: hpsRow?.sa1 ?? null,
          sa2Hps: hpsRow?.sa2 ?? null,
          teHps: hpsRow?.te ?? null,
        };
        return calculateGrade(scores, subject.subjectType);
      });
      const withGrade = grades.filter((g): g is CalculatedGrade => g?.transmuted != null);
      const average = withGrade.length
        ? Math.round(
            (withGrade.reduce((s, g) => s + g.transmuted!, 0) / withGrade.length) * 10
          ) / 10
        : null;

      const rawByTerm = [1, 2, 3].map((term) => {
        const termData = row?.terms.find((t) => t.term === term);
        if (!termData?.scores) return null;
        const raw = termData.scores[learner.id] as ComponentScores | undefined;
        const hps = termData.scores['__hps__'] as unknown as ComponentScores | undefined;
        return { raw: raw ?? emptyComponentScores(), hps: hps ?? emptyComponentScores() };
      });

      return { subject, grades, average, rawByTerm };
    });
  }, [section, learner]);

  const generalAverage = useMemo(() => {
    const vals = subjectRows
      .map((r) => r.average)
      .filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [subjectRows]);

  // Presentational only: the PWA's summary row shows a per-term GENERAL
  // AVERAGE as well as the overall one (StudentGradeReport.tsx:803-828).
  // Derived from the grades already calculated above — no grading maths change.
  const perTermAvg = (i: number) => {
    const vals = subjectRows
      .map((r) => r.grades[i]?.transmuted)
      .filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const attPeriod: AttendancePeriodFilter = useMemo(() => {
    if (attMonth) return { mode: 'month', year: attMonth.year, month: attMonth.month };
    if (attMode === 'all') return { mode: 'all' };
    const term = Number(attMode) as 1 | 2 | 3;
    const range = termDates[term];
    return {
      mode: 'term',
      term,
      start: range?.start ?? '',
      end: range?.end ?? '',
    };
  }, [attMode, attMonth, termDates]);

  const attendance =
    section && learner
      ? getLearnerAttendanceTotals(section.id, learner.id, attPeriod)
      : null;
  const attMonths =
    section && learner ? getLearnerAttendanceMonths(section.id, learner.id) : [];

  if (!section || !learner) {
    return (
      <View style={styles.screen}>
        <Header title="Student Report" onBack={() => router.back()} />
      </View>
    );
  }

  const maleCount = roster.filter((l) => l.gender === 'Male').length;
  const genderRank =
    learner.gender === 'Male'
      ? roster.filter((l) => l.gender === 'Male').findIndex((l) => l.id === learner.id) + 1
      : roster.filter((l) => l.gender === 'Female').findIndex((l) => l.id === learner.id) + 1;
  const genderTotal =
    learner.gender === 'Male' ? maleCount : roster.length - maleCount;

  const renderBreakdown = (
    subject: Subject,
    term: Term,
    g: CalculatedGrade | null,
    raw: ComponentScores | null,
    hps: ComponentScores | null
  ) => {
    if (!g || !raw) {
      return (
        <Text style={{ color: colors.textMuted, fontSize: 12, padding: spacing.sm }}>
          No scores recorded yet for this term.
        </Text>
      );
    }
    const meta = g.letter ? GRADE_META[g.letter] : null;
    const weights = getWeights(subject.subjectType);
    const wwLabels = ['WW1', 'WW2', 'WW3', 'WW4', 'WW5'];
    const ptLabels = ['PT1', 'PT2', 'PT3'];

    const wwVals = raw.ww ?? [];
    const wwHps = hps?.ww ?? [];
    const ptVals = raw.pt ?? [];
    const ptHps = hps?.pt ?? [];

    const wwTotal = wwVals.some((v) => v != null)
      ? wwVals.reduce((s: number, v) => s + (v ?? 0), 0)
      : null;
    const wwHpsTotal = wwHps.some((v) => v != null)
      ? wwHps.reduce((s: number, v) => s + (v ?? 0), 0)
      : null;
    const ptTotal = ptVals.some((v) => v != null)
      ? ptVals.reduce((s: number, v) => s + (v ?? 0), 0)
      : null;
    const ptHpsTotal = ptHps.some((v) => v != null)
      ? ptHps.reduce((s: number, v) => s + (v ?? 0), 0)
      : null;
    const qaHas =
      raw.sa1 != null || raw.sa2 != null || raw.te != null;
    const qaTotal = qaHas
      ? (raw.sa1 ?? 0) + (raw.sa2 ?? 0) + (raw.te ?? 0)
      : null;
    const qaHpsHas =
      hps?.sa1 != null || hps?.sa2 != null || hps?.te != null;
    const qaHpsTotal = qaHpsHas
      ? (hps?.sa1 ?? 0) + (hps?.sa2 ?? 0) + (hps?.te ?? 0)
      : null;

    return (
      <View style={styles.breakdownBox}>
        <View style={styles.breakdownTitleRow}>
          <Text style={styles.breakdownTitle}>
            {subject.name} — Term {term}
          </Text>
          {meta && (
            <View style={[styles.letterPill, { backgroundColor: meta.bg }]}>
              <Text style={[styles.letterPillText, { color: meta.color }]}>
                {g.letter} · {meta.label}
              </Text>
            </View>
          )}
        </View>

        {/* Written Works — with PS + Weighted Score */}
        {/* PWA ComponentBlock heading: title left, "Weight N%" right
            (StudentGradeReport.tsx:283-286) */}
        <View style={styles.compHeadingRow}>
          <Text style={styles.compHeadingTitle}>Written Works</Text>
          <Text style={styles.weightHint}>
            Weight {Math.round(weights.written * 100)}%
          </Text>
        </View>
        <View style={styles.compTable}>
          <View style={styles.compHeaderRow}>
            {wwLabels.map((lab, i) => (
              <Text key={lab} style={styles.compHeaderCell}>
                {wwVals[i] != null || wwHps[i] != null ? lab : ''}
              </Text>
            ))}
            <Text style={styles.compHeaderCell}>Total</Text>
            <Text style={styles.compHeaderCell}>PS</Text>
          </View>
          <View style={styles.compValueRow}>
            {wwLabels.map((lab, i) => (
              <View key={lab} style={styles.compValueCell}>
                {wwVals[i] != null || wwHps[i] != null ? (
                  <ScoreCell score={wwVals[i]} hps={wwHps[i]} />
                ) : null}
              </View>
            ))}
            <View style={styles.compValueCell}>
              <ScoreCell score={wwTotal} hps={wwHpsTotal} />
            </View>
            <View style={styles.compValueCell}>
              <Text style={styles.psText}>
                {g.wwPs != null ? `${g.wwPs.toFixed(1)}%` : '—'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.wsLine}>
          Weighted Score:{' '}
          <Text style={styles.wsValue}>{g.wwWs != null ? g.wwWs.toFixed(1) : '—'}</Text>
        </Text>

        {/* Performance Tasks */}
        <View style={styles.compHeadingRow}>
          <Text style={styles.compHeadingTitle}>Performance Tasks</Text>
          <Text style={styles.weightHint}>
            Weight {Math.round(weights.performance * 100)}%
          </Text>
        </View>
        <View style={styles.compTable}>
          <View style={styles.compHeaderRow}>
            {ptLabels.map((lab, i) => (
              <Text key={lab} style={styles.compHeaderCell}>
                {ptVals[i] != null || ptHps[i] != null ? lab : ''}
              </Text>
            ))}
            <Text style={styles.compHeaderCell}>Total</Text>
            <Text style={styles.compHeaderCell}>PS</Text>
          </View>
          <View style={styles.compValueRow}>
            {ptLabels.map((lab, i) => (
              <View key={lab} style={styles.compValueCell}>
                {ptVals[i] != null || ptHps[i] != null ? (
                  <ScoreCell score={ptVals[i]} hps={ptHps[i]} />
                ) : null}
              </View>
            ))}
            <View style={styles.compValueCell}>
              <ScoreCell score={ptTotal} hps={ptHpsTotal} />
            </View>
            <View style={styles.compValueCell}>
              <Text style={styles.psText}>
                {g.ptPs != null ? `${g.ptPs.toFixed(1)}%` : '—'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.wsLine}>
          Weighted Score:{' '}
          <Text style={styles.wsValue}>{g.ptWs != null ? g.ptWs.toFixed(1) : '—'}</Text>
        </Text>

        {/* Quarterly Assessment */}
        <View style={styles.compHeadingRow}>
          <Text style={styles.compHeadingTitle}>Quarterly Assessment</Text>
          <Text style={styles.weightHint}>
            Weight {Math.round(weights.quarterly * 100)}%
          </Text>
        </View>
        <View style={styles.compTable}>
          <View style={styles.compHeaderRow}>
            <Text style={styles.compHeaderCell}>SA1</Text>
            <Text style={styles.compHeaderCell}>SA2</Text>
            <Text style={styles.compHeaderCell}>TE</Text>
            <Text style={styles.compHeaderCell}>Total</Text>
            <Text style={styles.compHeaderCell}>PS</Text>
          </View>
          <View style={styles.compValueRow}>
            <View style={styles.compValueCell}>
              <ScoreCell score={raw.sa1} hps={hps?.sa1} />
            </View>
            <View style={styles.compValueCell}>
              <ScoreCell score={raw.sa2} hps={hps?.sa2} />
            </View>
            <View style={styles.compValueCell}>
              <ScoreCell score={raw.te} hps={hps?.te} />
            </View>
            <View style={styles.compValueCell}>
              <ScoreCell score={qaTotal} hps={qaHpsTotal} />
            </View>
            <View style={styles.compValueCell}>
              <Text style={styles.psText}>
                {g.qaPs != null ? `${g.qaPs.toFixed(1)}%` : '—'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.wsLine}>
          Weighted Score:{' '}
          <Text style={styles.wsValue}>{g.qaWs != null ? g.qaWs.toFixed(1) : '—'}</Text>
        </Text>

        <View style={styles.initialGradeRow}>
          <View>
            <Text style={styles.initialLabel}>Initial Grade</Text>
            <Text style={styles.initialValue}>{g.initial ?? '—'}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View>
            <Text style={styles.initialLabel}>Transmuted</Text>
            <Text style={styles.transmutedValue}>
              {g.transmuted ?? '—'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Student Report"
        subtitle={`${section.gradeLevel} - ${section.name}`}
        onBack={() => router.back()}
      />
      <DuplicateBanner section={section} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search student by name or number…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.trim().length > 0 && filteredRoster.length > 0 && (
            <View style={styles.searchResults}>
              {filteredRoster.slice(0, 6).map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => {
                    setLearnerId(l.id);
                    setSearch('');
                  }}
                  style={styles.searchResultRow}
                >
                  <Text style={styles.searchResultText}>
                    {l.order}. {l.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.navRow}>
            <Pressable
              onPress={goPrev}
              disabled={currentIndex <= 0}
              style={[styles.navBtn, currentIndex <= 0 && styles.navBtnDisabled]}
            >
              <Text style={styles.navBtnText}>◀ Prev</Text>
            </Pressable>
            <View style={styles.navCenter}>
              <Text style={styles.navName} numberOfLines={1}>
                {currentIndex + 1}. {learner.name}
              </Text>
            </View>
            <Pressable
              onPress={goNext}
              disabled={currentIndex < 0 || currentIndex >= roster.length - 1}
              style={[
                styles.navBtn,
                styles.navBtnPrimary,
                (currentIndex < 0 || currentIndex >= roster.length - 1) &&
                  styles.navBtnDisabled,
              ]}
            >
              <Text style={[styles.navBtnText, { color: '#fff' }]}>Next ▶</Text>
            </Pressable>
          </View>

          <Text style={styles.learnerTitle}>
            {learner.gender === 'Male' ? '♂' : '♀'} {learner.name}
          </Text>
          <Text style={styles.learnerSub}>
            {learner.gender} · #{genderRank} of {genderTotal}
          </Text>
        </Card>

        <StudentNotes
          sectionId={section.id}
          learnerId={learner.id}
          subjects={section.subjects ?? []}
        />

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={styles.cardTitle}>ATTENDANCE</Text>
          <View style={styles.attModeRow}>
            {(['all', '1', '2', '3'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setAttMode(m);
                  setAttMonth(null);
                }}
                style={[
                  styles.attModeChip,
                  attMode === m && !attMonth && styles.attModeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.attModeChipText,
                    attMode === m && !attMonth && styles.attModeChipTextActive,
                  ]}
                >
                  {m === 'all' ? 'All' : `T${m}`}
                </Text>
              </Pressable>
            ))}
          </View>

          {attMonths.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.sm }}
            >
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => setAttMonth(null)}
                  style={[styles.monthChip, !attMonth && styles.monthChipActive]}
                >
                  <Text
                    style={[
                      styles.monthChipText,
                      !attMonth && styles.monthChipTextActive,
                    ]}
                  >
                    All months
                  </Text>
                </Pressable>
                {attMonths.map((m) => {
                  const active =
                    attMonth?.year === m.year && attMonth?.month === m.month;
                  return (
                    <Pressable
                      key={`${m.year}-${m.month}`}
                      onPress={() => {
                        setAttMonth(m);
                        setAttMode('all');
                      }}
                      style={[styles.monthChip, active && styles.monthChipActive]}
                    >
                      <Text
                        style={[
                          styles.monthChipText,
                          active && styles.monthChipTextActive,
                        ]}
                      >
                        {monthLabel(m.year, m.month)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <Text style={styles.attPeriodLabel}>
            {attMonth
              ? monthLabel(attMonth.year, attMonth.month)
              : attMode === 'all'
                ? 'All recorded days'
                : `Term ${attMode}`}
          </Text>

          {attendance && (
            <View style={styles.attStats}>
              <Text style={styles.attStatText}>
                Present <Text style={styles.attStatNum}>{attendance.present}</Text>
              </Text>
              <Text style={styles.attStatText}>
                Absent <Text style={styles.attStatNum}>{attendance.absent}</Text>
              </Text>
              <Text style={styles.attStatText}>
                Late <Text style={styles.attStatNum}>{attendance.late}</Text>
              </Text>
              <Text style={styles.attStatText}>
                Excused <Text style={styles.attStatNum}>{attendance.excused}</Text>
              </Text>
              <Text style={styles.attStatText}>
                Cutting <Text style={styles.attStatNum}>{attendance.cutting}</Text>
              </Text>
              <Text style={styles.attStatText}>
                Rate{' '}
                <Text style={[styles.attStatNum, { color: colors.maroon }]}>
                  {attendance.rate != null ? `${attendance.rate}%` : '—'}
                </Text>
              </Text>
            </View>
          )}
        </Card>

        {/* Grades grid — mirrors the PWA's printable table, incl. the GEN. AVG
            column and the GENERAL AVERAGE summary row
            (StudentGradeReport.tsx:714-829) */}
        <Card style={styles.gridCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.gridInner}>
              <View style={styles.subjectTableHeader}>
                <Text style={[styles.subjectTableHeaderText, styles.subjectCol]}>
                  SUBJECT
                </Text>
                <Text style={[styles.subjectTableHeaderText, styles.termCol]}>T1</Text>
                <Text style={[styles.subjectTableHeaderText, styles.termCol]}>T2</Text>
                <Text style={[styles.subjectTableHeaderText, styles.termCol]}>T3</Text>
                <Text style={[styles.subjectTableHeaderText, styles.avgCol]}>
                  GEN. AVG
                </Text>
              </View>

              {subjectRows.map(({ subject, grades, average, rawByTerm }) => (
                <View key={subject.id}>
                  <View style={styles.subjectTableRow}>
                    <Text
                      style={[styles.subjectName, styles.subjectCol]}
                      numberOfLines={2}
                    >
                      {subject.name}
                    </Text>
                    {[0, 1, 2].map((i) => {
                      const g = grades[i];
                      const key = `${subject.id}-t${i + 1}`;
                      const meta = g?.letter ? GRADE_META[g.letter] : null;
                      const isOpen = expandedKey === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => setExpandedKey(isOpen ? null : key)}
                          style={[styles.termCol, styles.termCell]}
                        >
                          {g?.transmuted != null ? (
                            <View
                              style={[
                                styles.termBadge,
                                meta && { backgroundColor: meta.bg },
                                isOpen && { borderWidth: 2, borderColor: colors.maroon },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.termBadgeText,
                                  meta && { color: meta.color },
                                ]}
                              >
                                {g.transmuted}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.termDash}>—</Text>
                          )}
                        </Pressable>
                      );
                    })}
                    <Text style={styles.avgValue}>
                      {average != null ? average.toFixed(1) : '—'}
                    </Text>
                  </View>

                  {[0, 1, 2].map((i) => {
                    const key = `${subject.id}-t${i + 1}`;
                    if (expandedKey !== key) return null;
                    const bundle = rawByTerm[i];
                    return (
                      <View key={`exp-${key}`}>
                        {renderBreakdown(
                          subject,
                          (i + 1) as Term,
                          grades[i],
                          bundle?.raw ?? null,
                          bundle?.hps ?? null
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.subjectCol]}>
                  GENERAL AVERAGE
                </Text>
                {[0, 1, 2].map((i) => (
                  <Text key={i} style={[styles.summaryTerm, styles.termCol]}>
                    {perTermAvg(i) != null ? perTermAvg(i)!.toFixed(1) : '—'}
                  </Text>
                ))}
                <Text style={styles.summaryAvg}>
                  {generalAverage != null ? generalAverage.toFixed(1) : '—'}
                </Text>
              </View>
            </View>
          </ScrollView>
        </Card>

        <Text style={styles.hint}>
          Tap any grade to see its full Written Works / Performance Tasks / Quarterly
          breakdown.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  searchResults: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  searchResultRow: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultText: { fontSize: 13, color: colors.text },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.maroon,
    backgroundColor: colors.surface,
  },
  navBtnPrimary: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 12, fontWeight: '700', color: colors.maroon },
  navCenter: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.cream,
  },
  navName: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  learnerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.maroon,
    marginTop: spacing.xs,
  },
  learnerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardTitle: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 13,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  attModeRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  attModeChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.maroon,
    backgroundColor: colors.surface,
  },
  attModeChipActive: { backgroundColor: colors.maroon },
  attModeChipText: { fontSize: 12, fontWeight: '700', color: colors.maroon },
  attModeChipTextActive: { color: '#fff' },
  monthChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  monthChipActive: {
    borderColor: colors.maroon,
    backgroundColor: colors.cream,
  },
  monthChipText: { fontSize: 11, color: colors.textMuted },
  monthChipTextActive: { color: colors.maroon, fontWeight: '700' },
  attPeriodLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  attStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attStatText: { fontSize: 13, color: colors.textMuted },
  attStatNum: { fontWeight: '700', color: colors.text },

  // Grades grid card: the PWA wraps the table in `.card` with padding:0 +
  // overflow hidden (StudentGradeReport.tsx:720); Card supplies surface/border.
  gridCard: { padding: 0, overflow: 'hidden' },
  // PWA inner wrapper minWidth:438 (StudentGradeReport.tsx:722)
  gridInner: { minWidth: 438 },
  subjectTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream, // PWA header row tint (StudentGradeReport.tsx:726)
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subjectTableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: 8,
  },
  // PWA column widths: SUBJECT 150 / term 66 / GEN.AVG 90
  // (StudentGradeReport.tsx:732-736)
  subjectCol: { width: 150, flexShrink: 0, paddingHorizontal: 10, textAlign: 'left' },
  termCol: { width: 66, flexShrink: 0, textAlign: 'center' },
  avgCol: { width: 90, flexShrink: 0, textAlign: 'center' },
  subjectTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48, // PWA row minHeight:48 (StudentGradeReport.tsx:744)
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  subjectName: {
    fontSize: 12, // PWA subject cell 12/600, single line (StudentGradeReport.tsx:749-755)
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 6,
  },
  termCell: { alignItems: 'center' },
  // PWA term cell centres the letter badge in its 66px column
  termBadge: {
    minWidth: 30, // PWA badge minWidth:30, padding 3x8, radius 8 (StudentGradeReport.tsx:220-230)
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  termBadgeText: { fontSize: 13, fontWeight: '700' },
  termDash: { fontSize: 14, color: colors.textMuted },
  avgValue: {
    width: 90, // PWA GEN.AVG cell width:90, 13/700 (StudentGradeReport.tsx:783-785)
    flexShrink: 0,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 13,
    color: colors.text,
  },

  // PWA "GENERAL AVERAGE" summary row: --hps-bg fill, minHeight 46
  // (StudentGradeReport.tsx:803-828)
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    backgroundColor: colors.hpsBg,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.maroon,
    paddingVertical: 6,
  },
  summaryTerm: { fontSize: 12, fontWeight: '700', color: colors.text },
  summaryAvg: {
    width: 90,
    flexShrink: 0,
    textAlign: 'center',
    fontSize: 15,
    color: colors.maroon,
  },

  breakdownBox: {
    // PWA expanded panel uses --hps-bg (#fff8e0) (StudentGradeReport.tsx:789-794)
    backgroundColor: colors.hpsBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  breakdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: 6,
  },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: colors.text }, // PWA 13/700 (StudentGradeReport.tsx:362)
  letterPill: {
    // PWA letter pill: padding 2x8, radius 6 (StudentGradeReport.tsx:366-374)
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  letterPillText: { fontSize: 11, fontWeight: '700' },
  // PWA ComponentBlock heading row: title left, "Weight N%" right
  // (StudentGradeReport.tsx:283-286)
  compHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  compHeadingTitle: { fontSize: 13, fontWeight: '700', color: colors.maroon },
  // PWA ComponentBlock table has no outer border — each header/value cell draws
  // its own bottom border (StudentGradeReport.tsx:248-260, 306-318)
  compTable: { marginBottom: 4 },
  compHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
  },
  compHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compValueRow: { flexDirection: 'row', backgroundColor: colors.surface },
  compValueCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scoreCellText: { fontSize: 13, color: colors.text },
  weightHint: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  psText: { fontSize: 13, fontWeight: '700', color: colors.maroon },
  wsLine: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  wsValue: { fontWeight: '700', color: colors.text },
  // PWA Initial→Transmuted block: cream fill, radius 10, padding 10x12,
  // justify space-between, gap 8 (StudentGradeReport.tsx:416-427)
  initialGradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    backgroundColor: colors.cream,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  initialLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  // PWA Initial Grade value is 16/700; the Transmuted value 20/800 in primary
  // (StudentGradeReport.tsx:429-452)
  initialValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  transmutedValue: { fontSize: 20, fontWeight: '800', color: colors.maroon },
  arrow: { fontSize: 18, color: colors.textMuted },

  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
