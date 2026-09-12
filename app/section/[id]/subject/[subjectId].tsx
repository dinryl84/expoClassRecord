import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/Header';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { Button, Card, SegmentedControl } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
import { getSectionById } from '@/db/repositories/sections';
import { getTermScoresForSubject, putTermScores } from '@/db/repositories/termScores';
import { getSetting, putSetting } from '@/db/repositories/settings';
import { calculateGrade, emptyComponentScores } from '@/utils/grades';
import { isScoreEdited } from '@/utils/editDiff';
import { GRADE_META, GRADE_ORDER } from '@/utils/gradeMeta';
import { exportClassRecord, saveClassRecordToFolder } from '@/utils/exportExcel';
import { printClassRecord, shareClassRecordPdf } from '@/utils/printClassRecord';
import type { CalculatedGrade, ComponentScores, Learner, Section, Subject, TermScores } from '@/types';

type Tab = 'ww' | 'pt' | 'qa';
type Term = 1 | 2 | 3;
type Mode = 'encode' | 'grades';
type ViewStyle = 'grid' | 'focus';

const EDIT_HIGHLIGHT_COLORS = [
  { id: 'blue', hex: '#1565C0' },
  { id: 'amber', hex: '#B26A00' },
  { id: 'purple', hex: '#6A1B9A' },
  { id: 'teal', hex: '#00695C' },
];

// Literal greys the PWA writes inline on this page (no theme token exists), so
// they are ported verbatim to keep the two visually identical.
const GRID_EMPTY_TEXT = '#888'; // PWA ScoreEncoding.tsx renderRows empty-row text
const GRID_ORDER_TEXT = '#999'; // PWA ScoreEncoding.tsx learner order prefix

const TAB_COLS: Record<
  Tab,
  { field: 'ww' | 'pt' | 'sa1' | 'sa2' | 'te'; label: string; index: number | null }[]
> = {
  ww: [0, 1, 2, 3, 4].map((i) => ({ field: 'ww', label: `WW${i + 1}`, index: i })),
  pt: [0, 1, 2].map((i) => ({ field: 'pt', label: `PT${i + 1}`, index: i })),
  qa: [
    { field: 'sa1', label: 'SA1', index: null },
    { field: 'sa2', label: 'SA2', index: null },
    { field: 'te', label: 'TE', index: null },
  ],
};

// PWA grid metrics (ScoreEncoding.tsx renderRows / renderHps): score columns
// are 52px, the sticky learner column 150px, the grade block min 110px.
const COL_W = 52;
const NAME_W = 150;
const GRADE_W = 110;

function getFieldValue(scores: ComponentScores, field: string, index: number | null): number | null {
  if (index !== null) return (scores[field as 'ww' | 'pt'] as (number | null)[])[index] ?? null;
  return (scores as any)[field] ?? null;
}

function setFieldValue(
  scores: ComponentScores,
  field: string,
  index: number | null,
  value: number | null
): ComponentScores {
  const next = { ...scores };
  if (index !== null) {
    const arr = [...((next[field as 'ww' | 'pt'] as (number | null)[]) ?? [])];
    arr[index] = value;
    (next as any)[field] = arr;
  } else {
    (next as any)[field] = value;
  }
  return next;
}

export default function ScoreEncoding() {
  const { id, subjectId } = useLocalSearchParams<{ id: string; subjectId: string }>();
  const [section, setSection] = useState<Section | null>(null);
  const [term, setTerm] = useState<Term>(1);
  const [tab, setTab] = useState<Tab>('ww');
  const [mode, setMode] = useState<Mode>('encode');
  const [viewStyle, setViewStyle] = useState<ViewStyle>('grid');
  const [scoresMap, setScoresMap] = useState<Record<string, ComponentScores>>({});
  const [hps, setHps] = useState<ComponentScores>(emptyComponentScores());
  const [baselineMap, setBaselineMap] = useState<Record<string, ComponentScores>>({});
  const [baselineHps, setBaselineHps] = useState<ComponentScores | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingToFolder, setSavingToFolder] = useState(false);
  const [printing, setPrinting] = useState<'print' | 'pdf' | null>(null);
  const [highlightEdits, setHighlightEdits] = useState(true);
  const [highlightColor, setHighlightColor] = useState(EDIT_HIGHLIGHT_COLORS[0].hex);

  useEffect(() => {
    if (id) setSection(getSectionById(id));
  }, [id]);

  // Restore highlight prefs (duplicates only), matching PWA.
  useEffect(() => {
    if (!section?.isDuplicate) return;
    const enabled = getSetting<boolean>('editHighlightEnabled');
    const color = getSetting<string>('editHighlightColor');
    if (enabled !== null) setHighlightEdits(!!enabled);
    if (color) setHighlightColor(color);
  }, [section?.isDuplicate]);

  const subject: Subject | undefined = section?.subjects.find((s) => s.id === subjectId);

  const males = useMemo(() => {
    if (!section) return [];
    return section.learners.filter((l) => l.gender === 'Male').sort((a, b) => a.order - b.order);
  }, [section]);
  const females = useMemo(() => {
    if (!section) return [];
    return section.learners.filter((l) => l.gender === 'Female').sort((a, b) => a.order - b.order);
  }, [section]);
  const roster = useMemo(() => [...males, ...females], [males, females]);

  const loadScores = useCallback(() => {
    if (!subjectId) return;
    const row = getTermScoresForSubject(subjectId);
    const termData = row?.terms.find((t) => t.term === term);
    if (termData?.scores) {
      const { __hps__, ...rest } = termData.scores as Record<string, ComponentScores>;
      setScoresMap(rest);
      setHps(__hps__ ?? emptyComponentScores());
    } else {
      setScoresMap({});
      setHps(emptyComponentScores());
    }
    const baselineTermData = row?.baselineTerms?.find((t) => t.term === term);
    if (baselineTermData?.scores) {
      const { __hps__: bh, ...rest } = baselineTermData.scores as Record<string, ComponentScores>;
      setBaselineMap(rest);
      setBaselineHps(bh ?? null);
    } else {
      setBaselineMap({});
      setBaselineHps(null);
    }
  }, [subjectId, term]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  useEffect(() => {
    if (focusIndex >= roster.length) setFocusIndex(0);
  }, [roster, focusIndex]);

  // Debounced auto-save (800ms), same as PWA.
  useEffect(() => {
    if (!subjectId || Object.keys(scoresMap).length === 0) return;
    const t = setTimeout(() => {
      const existing = getTermScoresForSubject(subjectId);
      const terms: TermScores[] = existing?.terms ? [...existing.terms] : [];
      const idx = terms.findIndex((t2) => t2.term === term);
      const payload = { ...scoresMap, __hps__: hps } as unknown as TermScores['scores'];
      if (idx >= 0) terms[idx] = { term, scores: payload };
      else terms.push({ term, scores: payload });
      putTermScores({
        id: existing?.id || `${subjectId}-scores`,
        subjectId,
        terms,
        baselineTerms: existing?.baselineTerms,
      });
      setLastSaved(new Date().toLocaleTimeString());
    }, 800);
    return () => clearTimeout(t);
  }, [scoresMap, hps, subjectId, term]);

  if (!section || !subject) {
    return (
      <View style={styles.screen}>
        <Header title="Score Encoding" onBack={() => router.back()} />
      </View>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const { overflowLearners, shared, fileUri } = await exportClassRecord({ section, subject });
      if (overflowLearners.length > 0) {
        const names = overflowLearners.map((l) => l.name).join(', ');
        Alert.alert(
          `${overflowLearners.length} student${overflowLearners.length !== 1 ? 's' : ''} didn't fit`,
          `The template only supports 50 students per gender. These students were left out of the exported file: ${names}`
        );
      } else if (!shared) {
        // Sharing wasn't available on this device — the file still exists,
        // but the user needs to know where, since no share sheet appeared.
        Alert.alert(
          'Export saved',
          `Sharing isn't available on this device, so the file was saved inside the app instead of opening a share sheet:\n\n${fileUri}`
        );
      }
      // If shared === true, the OS share sheet already gave the user feedback.
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveToFolder = async () => {
    setSavingToFolder(true);
    try {
      const { overflowLearners, savedUri } = await saveClassRecordToFolder({ section, subject });
      if (overflowLearners.length > 0) {
        const names = overflowLearners.map((l) => l.name).join(', ');
        Alert.alert(
          `${overflowLearners.length} student${overflowLearners.length !== 1 ? 's' : ''} didn't fit`,
          `The template only supports 50 students per gender. These students were left out of the exported file: ${names}`
        );
      } else if (savedUri) {
        Alert.alert('Saved', 'The class record was saved to the folder you selected.');
      }
      // If savedUri is null, the user cancelled the folder picker — no alert needed.
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Something went wrong.');
    } finally {
      setSavingToFolder(false);
    }
  };

  const handlePrint = async () => {
    setPrinting('print');
    try {
      await printClassRecord(section, subject);
    } catch (e: any) {
      Alert.alert('Print failed', e?.message ?? 'Something went wrong.');
    } finally {
      setPrinting(null);
    }
  };

  const handleSharePdf = async () => {
    setPrinting('pdf');
    try {
      await shareClassRecordPdf(section, subject);
    } catch (e: any) {
      Alert.alert('Could not create PDF', e?.message ?? 'Something went wrong.');
    } finally {
      setPrinting(null);
    }
  };

  const getLearnerScores = (learnerId: string): ComponentScores => {
    const s = scoresMap[learnerId] || emptyComponentScores();
    return { ...s, wwHps: hps.ww, ptHps: hps.pt, sa1Hps: hps.sa1, sa2Hps: hps.sa2, teHps: hps.te };
  };

  const updateScore = (learnerId: string, field: string, index: number | null, text: string) => {
    const value = text === '' ? null : Number(text);
    setScoresMap((prev) => ({
      ...prev,
      [learnerId]: setFieldValue(prev[learnerId] || emptyComponentScores(), field, index, value),
    }));
  };

  const updateHps = (field: string, index: number | null, text: string) => {
    const value = text === '' ? null : Number(text);
    setHps((prev) => setFieldValue(prev, field, index, value));
  };

  const toggleHighlightEdits = () => {
    const next = !highlightEdits;
    setHighlightEdits(next);
    putSetting('editHighlightEnabled', next);
  };

  const chooseHighlightColor = (hex: string) => {
    setHighlightColor(hex);
    putSetting('editHighlightColor', hex);
  };

  const cols = TAB_COLS[tab];
  const showHighlights = !!section.isDuplicate && highlightEdits;

  const current = roster[focusIndex];
  const searchResults = search.trim()
    ? roster.filter((l) => l.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6)
    : [];

  const jumpTo = (learnerId: string) => {
    const idx = roster.findIndex((l) => l.id === learnerId);
    if (idx !== -1) setFocusIndex(idx);
    setSearch('');
  };

  // Grades mode summary
  interface Row {
    learner: Learner;
    grade: CalculatedGrade | null;
  }
  const gradeRows: Row[] = section.learners
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((l) => {
      const s = scoresMap[l.id];
      const grade = s ? calculateGrade(getLearnerScores(l.id), subject.subjectType) : null;
      return { learner: l, grade };
    });
  const withGrade = gradeRows.filter((r) => r.grade?.transmuted != null);
  const avg = withGrade.length
    ? withGrade.reduce((sum, r) => sum + (r.grade!.transmuted ?? 0), 0) / withGrade.length
    : null;
  const highest = withGrade.length
    ? withGrade.reduce((m, r) =>
        (r.grade!.transmuted ?? 0) > (m.grade!.transmuted ?? 0) ? r : m
      )
    : null;
  const lowest = withGrade.length
    ? withGrade.reduce((m, r) =>
        (r.grade!.transmuted ?? 100) < (m.grade!.transmuted ?? 100) ? r : m
      )
    : null;
  const atRisk = withGrade.filter((r) => (r.grade!.transmuted ?? 100) < 75).length;
  const distribution = GRADE_ORDER.map((letter) => ({
    letter,
    count: withGrade.filter((r) => r.grade!.letter === letter).length,
  }));
  const distTotal = withGrade.length || 1;

  const openStudentReport = (learnerId: string) => {
    router.push(`/section/${section.id}/learner/${learnerId}`);
  };

  const renderGridCell = (
    learnerId: string | null,
    c: (typeof cols)[number],
    value: number | null,
    isHps: boolean,
    edited: boolean
  ) => (
    <View key={`${learnerId ?? 'hps'}-${c.label}`} style={styles.gridCell}>
      <TextInput
        style={[
          styles.gridInput,
          edited && { color: highlightColor, fontWeight: '700' },
        ]}
        keyboardType="numeric"
        value={value?.toString() ?? ''}
        onChangeText={(t) =>
          isHps
            ? updateHps(c.field, c.index, t)
            : learnerId
              ? updateScore(learnerId, c.field, c.index, t)
              : undefined
        }
        placeholder="—"
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );

  const renderGridRow = (l: Learner) => {
    const sc = getLearnerScores(l.id);
    const grade = calculateGrade(sc, subject.subjectType);
    const learnerScores = scoresMap[l.id] || emptyComponentScores();
    return (
      <View key={l.id} style={styles.gridRow}>
        <View style={[styles.gridNameCell, { backgroundColor: colors.surface }]}>
          <Text style={styles.gridNameText} numberOfLines={1}>
            <Text style={{ color: GRID_ORDER_TEXT }}>{l.order}. </Text>
            {l.name}
          </Text>
        </View>
        {cols.map((c) => {
          const value = getFieldValue(learnerScores, c.field, c.index);
          const edited =
            showHighlights && isScoreEdited(baselineMap[l.id], learnerScores, c.field, c.index);
          return renderGridCell(l.id, c, value, false, edited);
        })}
        <View style={styles.gridGradeCell}>
          <Text style={styles.gridIg}>{grade.initial != null ? grade.initial.toFixed(0) : '—'}</Text>
          <Text style={styles.gridTg}>{grade.transmuted ?? '—'}</Text>
          <Text style={styles.gridLg}>{grade.letter ?? '—'}</Text>
        </View>
      </View>
    );
  };

  const renderGrid = () => {
    const tableWidth = NAME_W + cols.length * COL_W + GRADE_W;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={{ minWidth: tableWidth }}>
          {/* Header */}
          <View style={[styles.gridRow, styles.gridHeader]}>
            <View style={[styles.gridNameCell, { backgroundColor: colors.cream }]}>
              <Text style={styles.gridHeaderText}>LEARNER</Text>
            </View>
            {cols.map((c) => (
              <View key={c.label} style={[styles.gridCell, { backgroundColor: colors.cream }]}>
                <Text style={styles.gridHeaderText}>{c.label}</Text>
              </View>
            ))}
            <View
              style={[styles.gridGradeCell, { backgroundColor: colors.cream, justifyContent: 'space-around' }]}
            >
              <Text style={styles.gridHeaderText}>IG</Text>
              <Text style={styles.gridHeaderText}>TG</Text>
              <Text style={styles.gridHeaderText}>LG</Text>
            </View>
          </View>

          {/* HPS row */}
          <View style={[styles.gridRow, styles.gridHpsRow]}>
            <View style={[styles.gridNameCell, styles.gridHpsNameCell]}>
              <Text style={[styles.gridNameText, { color: colors.maroon, fontWeight: '700', fontSize: 10 }]}>
                HIGHEST POSSIBLE
              </Text>
            </View>
            {cols.map((c) => {
              const value = getFieldValue(hps, c.field, c.index);
              const edited =
                showHighlights &&
                baselineHps != null &&
                isScoreEdited(baselineHps, hps, c.field, c.index);
              return renderGridCell(null, c, value, true, edited);
            })}
            <View style={styles.gridGradeCell} />
          </View>

          {/* Male section */}
          <View style={[styles.gridSectionBanner, { backgroundColor: colors.maroon }]}>
            <Text style={styles.gridSectionBannerText}>♂ MALE ({males.length})</Text>
          </View>
          {males.length === 0 ? (
            <Text style={styles.emptyGridText}>No male learners</Text>
          ) : (
            males.map(renderGridRow)
          )}

          {/* Female section */}
          <View style={[styles.gridSectionBanner, { backgroundColor: colors.orange }]}>
            <Text style={styles.gridSectionBannerText}>♀ FEMALE ({females.length})</Text>
          </View>
          {females.length === 0 ? (
            <Text style={styles.emptyGridText}>No female learners</Text>
          ) : (
            females.map(renderGridRow)
          )}
        </View>
      </ScrollView>
    );
  };

  const renderFocus = () => (
    <View>
      <View style={{ marginBottom: spacing.sm }}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search learner to jump to…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {searchResults.length > 0 && (
          <Card style={{ marginTop: 4, padding: 0 }}>
            {searchResults.map((l) => (
              <Pressable key={l.id} onPress={() => jumpTo(l.id)} style={styles.searchResultRow}>
                <Text style={{ fontSize: 13, color: colors.text }}>{l.name}</Text>
              </Pressable>
            ))}
          </Card>
        )}
      </View>

      {roster.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: spacing.lg }}>
          <Text style={{ color: colors.textMuted }}>No learners in this section yet.</Text>
        </Card>
      ) : current ? (
        <Card>
          <View style={styles.focusNav}>
            <Button
              label="← Prev"
              variant="secondary"
              disabled={focusIndex === 0}
              onPress={() => setFocusIndex((i) => Math.max(0, i - 1))}
              style={{ flex: 1 }}
            />
            <Text style={styles.focusCounter}>
              {focusIndex + 1} / {roster.length}
            </Text>
            <Button
              label="Next →"
              variant="secondary"
              disabled={focusIndex === roster.length - 1}
              onPress={() => setFocusIndex((i) => Math.min(roster.length - 1, i + 1))}
              style={{ flex: 1 }}
            />
          </View>

          <Text style={styles.focusName}>
            {current.gender === 'Male' ? '♂' : '♀'} {current.name}
          </Text>

          <Pressable onPress={() => {}} style={styles.hpsToggle}>
            <Text style={styles.hpsToggleText}>Highest Possible Scores</Text>
          </Pressable>
          <View style={styles.hpsRow}>
            {cols.map((c) => (
              <View key={c.label} style={{ flex: 1 }}>
                <Text style={styles.hpsLabel}>{c.label}</Text>
                <TextInput
                  style={styles.hpsInput}
                  keyboardType="numeric"
                  value={getFieldValue(hps, c.field, c.index)?.toString() ?? ''}
                  onChangeText={(t) => updateHps(c.field, c.index, t)}
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ))}
          </View>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {cols.map((c) => {
              const learnerScores = scoresMap[current.id] || emptyComponentScores();
              const value = getFieldValue(learnerScores, c.field, c.index);
              const edited =
                showHighlights &&
                isScoreEdited(baselineMap[current.id], learnerScores, c.field, c.index);
              return (
                <View key={c.label} style={styles.scoreFieldRow}>
                  <Text style={styles.scoreFieldLabel}>{c.label}</Text>
                  <TextInput
                    style={[
                      styles.scoreInput,
                      edited && { borderColor: highlightColor, color: highlightColor, fontWeight: '700' },
                    ]}
                    keyboardType="numeric"
                    value={value?.toString() ?? ''}
                    onChangeText={(t) => updateScore(current.id, c.field, c.index, t)}
                    placeholder="—"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              );
            })}
          </View>

          {(() => {
            const g = calculateGrade(getLearnerScores(current.id), subject.subjectType);
            return (
              <View style={styles.focusGradeBar}>
                <Text style={styles.focusGradeItem}>
                  IG <Text style={{ fontWeight: '700', color: colors.maroon }}>{g.initial ?? '—'}</Text>
                </Text>
                <Text style={styles.focusGradeItem}>
                  TG <Text style={{ fontWeight: '700', color: colors.green }}>{g.transmuted ?? '—'}</Text>
                </Text>
                <Text style={styles.focusGradeItem}>
                  LG <Text style={{ fontWeight: '700' }}>{g.letter ?? '—'}</Text>
                </Text>
              </View>
            );
          })()}
        </Card>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Header
        title={subject.name}
        subtitle={section.name}
        onBack={() => router.back()}
        rightLabel={mode === 'encode' ? 'View Grades' : 'Back to Encoding'}
        onRightPress={() => setMode(mode === 'encode' ? 'grades' : 'encode')}
      />
      <DuplicateBanner section={section} />

      <View style={styles.termBar}>
        <SegmentedControl
          options={[
            { label: 'Term 1', value: 1 as Term },
            { label: 'Term 2', value: 2 as Term },
            { label: 'Term 3', value: 3 as Term },
          ]}
          value={term}
          onChange={setTerm}
        />
        <Button
          label={exporting ? 'Exporting…' : '📤 Export to Excel'}
          variant="secondary"
          onPress={handleExport}
          loading={exporting}
          style={{ marginTop: spacing.sm }}
        />
        <Button
          label={savingToFolder ? 'Saving…' : '💾 Save to Folder'}
          variant="secondary"
          onPress={handleSaveToFolder}
          loading={savingToFolder}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      {mode === 'encode' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
          {/* Highlight controls for duplicates */}
          {section.isDuplicate && (
            <Card style={{ marginBottom: spacing.md }}>
              <Pressable onPress={toggleHighlightEdits} style={styles.highlightToggleRow}>
                <View
                  style={[
                    styles.checkbox,
                    highlightEdits && { backgroundColor: colors.maroon, borderColor: colors.maroon },
                  ]}
                >
                  {highlightEdits && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
                <Text style={styles.highlightToggleLabel}>Highlight edited scores</Text>
              </Pressable>
              {highlightEdits && (
                <View style={styles.colorRow}>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginRight: 8 }}>Color:</Text>
                  {EDIT_HIGHLIGHT_COLORS.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => chooseHighlightColor(c.hex)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.hex },
                        highlightColor === c.hex && styles.colorSwatchSelected,
                      ]}
                    />
                  ))}
                </View>
              )}
            </Card>
          )}

          <View style={styles.viewStyleRow}>
            <SegmentedControl
              options={[
                { label: 'Written', value: 'ww' as Tab },
                { label: 'Perf. Tasks', value: 'pt' as Tab },
                { label: 'Summative', value: 'qa' as Tab },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>

          <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
            <SegmentedControl
              options={[
                { label: 'Grid', value: 'grid' as ViewStyle },
                { label: 'Focus', value: 'focus' as ViewStyle },
              ]}
              value={viewStyle}
              onChange={setViewStyle}
            />
          </View>

          {viewStyle === 'grid' ? renderGrid() : renderFocus()}

          <View style={styles.footerBar}>
            <Text style={styles.footerText}>
              {lastSaved ? `Saved ${lastSaved}` : 'Autosave on'}
            </Text>
            <Text style={[styles.footerText, { color: colors.green }]}>● Live grades</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <View style={styles.printRow}>
            <Button
              label={printing === 'print' ? 'Opening…' : '🖨 Print'}
              variant="secondary"
              onPress={handlePrint}
              loading={printing === 'print'}
              disabled={printing !== null}
              style={{ flex: 1 }}
            />
            <Button
              label={printing === 'pdf' ? 'Preparing…' : '📄 Save/Share PDF'}
              variant="secondary"
              onPress={handleSharePdf}
              loading={printing === 'pdf'}
              disabled={printing !== null}
              style={{ flex: 1 }}
            />
          </View>

          <View style={styles.summaryRow}>
            <SummaryStat label="Class Average" value={avg != null ? avg.toFixed(1) : '—'} />
            <SummaryStat
              label="Highest"
              value={
                highest
                  ? `${highest.grade!.transmuted} · ${highest.learner.name.split(',')[0]}`
                  : '—'
              }
            />
            <SummaryStat
              label="Lowest"
              value={
                lowest
                  ? `${lowest.grade!.transmuted} · ${lowest.learner.name.split(',')[0]}`
                  : '—'
              }
            />
            <SummaryStat
              label="At Risk (<75)"
              value={withGrade.length ? String(atRisk) : '—'}
              danger={atRisk > 0}
            />
          </View>

          <View style={styles.distBar}>
            {distribution.map((d) => (
              <View
                key={d.letter}
                style={{
                  width: `${(d.count / distTotal) * 100}%`,
                  backgroundColor: GRADE_META[d.letter].color,
                  height: 8,
                }}
              />
            ))}
          </View>
          <View style={styles.distLegend}>
            {distribution.map((d) => (
              <Text key={d.letter} style={styles.distLegendText}>
                {d.letter} ({d.count})
              </Text>
            ))}
          </View>

          {/* Header: LEARNER · WW% · PT% · QA% */}
          <View style={styles.gradesTableHeader}>
            <Text style={[styles.gradesTableHeaderText, { flex: 1 }]}>LEARNER</Text>
            <Text style={[styles.gradesTableHeaderText, styles.gradesCol]}>WW%</Text>
            <Text style={[styles.gradesTableHeaderText, styles.gradesCol]}>PT%</Text>
            <Text style={[styles.gradesTableHeaderText, styles.gradesCol]}>QA%</Text>
          </View>

          <Text style={styles.gradesHint}>
            Tap a learner name to open their full Student Report
          </Text>

          <View style={{ gap: 0 }}>
            {gradeRows.map((row) => {
              const g = row.grade;
              const meta = g?.letter ? GRADE_META[g.letter] : null;
              const expanded = expandedId === row.learner.id;
              return (
                <View key={row.learner.id}>
                  <View
                    style={[styles.gradesTableRow, expanded && { backgroundColor: colors.hpsBg }]}
                  >
                    {/* Name → full Student Report (matches PWA onOpenReport) */}
                    <Pressable
                      onPress={() => openStudentReport(row.learner.id)}
                      style={styles.gradesNamePress}
                      accessibilityRole="button"
                      accessibilityLabel={`Open report for ${row.learner.name}`}
                    >
                      <Text style={styles.gradesName} numberOfLines={1}>
                        <Text style={{ color: colors.textMuted }}>{row.learner.order}. </Text>
                        {row.learner.gender === 'Male' ? '♂ ' : '♀ '}
                        <Text style={{ color: colors.maroon, fontWeight: '700' }}>
                          {row.learner.name}
                        </Text>
                      </Text>
                    </Pressable>

                    {/* Percent columns → expand inline breakdown */}
                    <Pressable
                      onPress={() => setExpandedId(expanded ? null : row.learner.id)}
                      style={styles.gradesPctPress}
                    >
                      <Text style={styles.gradesColVal}>
                        {g?.wwPs != null ? g.wwPs.toFixed(0) : '—'}
                      </Text>
                      <Text style={styles.gradesColVal}>
                        {g?.ptPs != null ? g.ptPs.toFixed(0) : '—'}
                      </Text>
                      <Text style={styles.gradesColVal}>
                        {g?.qaPs != null ? g.qaPs.toFixed(0) : '—'}
                      </Text>
                    </Pressable>
                  </View>
                  {expanded && (
                    <View style={styles.gradeDetail}>
                      {g ? (
                        <>
                          <Text
                            style={[
                              styles.gradeDetailBold,
                              meta && { color: meta.color },
                            ]}
                          >
                            {g.letter ? `${g.letter} — ${meta?.label}` : 'Incomplete'} · Final{' '}
                            {g.transmuted ?? '—'}
                          </Text>
                          <Text style={styles.gradeDetailLine}>
                            Written Works:{' '}
                            {g.wwPs != null ? `${g.wwPs.toFixed(1)}%` : '—'} × weight ={' '}
                            {g.wwWs != null ? g.wwWs.toFixed(1) : '—'}
                          </Text>
                          <Text style={styles.gradeDetailLine}>
                            Performance Tasks:{' '}
                            {g.ptPs != null ? `${g.ptPs.toFixed(1)}%` : '—'} × weight ={' '}
                            {g.ptWs != null ? g.ptWs.toFixed(1) : '—'}
                          </Text>
                          <Text style={styles.gradeDetailLine}>
                            Quarterly/Summative:{' '}
                            {g.qaPs != null ? `${g.qaPs.toFixed(1)}%` : '—'} × weight ={' '}
                            {g.qaWs != null ? g.qaWs.toFixed(1) : '—'}
                          </Text>
                          <Text style={styles.gradeDetailBold}>
                            Initial {g.initial ?? '—'} → Transmuted {g.transmuted ?? '—'}
                          </Text>
                          <Pressable
                            onPress={() => openStudentReport(row.learner.id)}
                            style={styles.openReportBtn}
                          >
                            <Text style={styles.openReportBtnText}>
                              Open full Student Report →
                            </Text>
                          </Pressable>
                        </>
                      ) : (
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          No scores recorded yet for this term.
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function SummaryStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, danger && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  termBar: { padding: spacing.md, paddingBottom: 0 },
  viewStyleRow: { marginBottom: spacing.xs },
  hpsToggle: { marginTop: spacing.md },
  hpsToggleText: { color: colors.maroon, fontWeight: '600', fontSize: 13, marginBottom: 6 },
  hpsRow: { flexDirection: 'row', gap: 8 },
  hpsLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4, textAlign: 'center' },
  hpsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    textAlign: 'center',
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  searchResultRow: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  focusNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  focusCounter: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  focusName: { fontSize: 18, fontWeight: '700', color: colors.maroon, marginTop: spacing.md },
  scoreFieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreFieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, width: 60 },
  // PWA focus input: `.score-input` overridden to 64x40, centred, 15px.
  scoreInput: {
    width: 64,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
    fontSize: 15,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  focusGradeBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  focusGradeItem: { fontSize: 13, color: colors.textMuted },
  footerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  footerText: { fontSize: 12, color: colors.textMuted },

  // Grid styles
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48, // PWA learner rows min-height:48
    backgroundColor: colors.surface,
  },
  gridHeader: { backgroundColor: colors.cream, minHeight: 40 }, // PWA header min-height:40
  // PWA HPS row: min-height:44 on the `--hps-bg` tint
  gridHpsRow: { backgroundColor: colors.hpsBg, minHeight: 44 },
  gridNameCell: {
    width: NAME_W,
    paddingHorizontal: 10, // PWA padding 8px 10px
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: 'center',
  },
  // PWA HPS name cell uses 6px 10px padding
  gridHpsNameCell: { paddingVertical: 6 },
  gridNameText: { fontSize: 12, color: colors.text, fontWeight: '500' }, // PWA 12px/500
  gridHeaderText: { fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' },
  gridCell: {
    width: COL_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  // PWA `.score-input` (theme.css): 42px wide, 6px 2px padding, 1px border,
  // 6px radius, 13px centred text on --color-surface.
  gridInput: {
    width: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  // NOTE: the PWA tints the HPS *row* with `--hps-bg` (colors.hpsBg) but
  // leaves the HPS score cells on `.score-input`'s white surface, so there is
  // deliberately no HPS-specific input background here.
  // PWA grade block: min-width 110, gap 6, 0 8px padding, left border.
  gridGradeCell: {
    width: GRADE_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingHorizontal: 8,
  },
  gridIg: { fontSize: 13, fontWeight: '600', color: colors.maroon, minWidth: 36, textAlign: 'center' },
  gridTg: { fontSize: 14, fontWeight: '700', color: colors.green, minWidth: 28, textAlign: 'center' },
  gridLg: { fontSize: 13, fontWeight: '600', color: colors.text, minWidth: 18, textAlign: 'center' },
  gridSectionBanner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  gridSectionBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' }, // PWA 600
  emptyGridText: {
    padding: 16, // PWA padding:16
    fontSize: 13,
    color: GRID_EMPTY_TEXT,
    textAlign: 'center',
  },

  // Highlight controls
  highlightToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightToggleLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  colorRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 8 },
  colorSwatch: {
    width: 18, // PWA swatch 18x18
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: { borderColor: colors.text },

  // Grades mode
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  printRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  distBar: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  distLegend: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  distLegendText: { fontSize: 11, color: colors.textMuted },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gradeName: { flex: 1, fontSize: 13, color: colors.text },
  gradeBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  gradeBadgeText: { fontSize: 12, fontWeight: '700' },
  gradeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    width: 36,
    textAlign: 'right',
  },
  gradeDetail: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.hpsBg, // PWA expanded grade tint = --hps-bg
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 3,
  },
  gradeDetailLine: { fontSize: 12, color: colors.textMuted },
  gradeDetailBold: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 2 },
  gradesTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: spacing.md,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
  },
  gradesTableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  gradesCol: { width: 48, textAlign: 'center' },
  gradesHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 4,
    textAlign: 'center',
  },
  gradesTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  gradesNamePress: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    paddingRight: 6,
  },
  gradesPctPress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 6,
  },
  gradesName: { fontSize: 12, color: colors.text },
  gradesColVal: {
    width: 48,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  openReportBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.maroon,
  },
  openReportBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
