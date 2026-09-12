import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/Header';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { Button, Card, SegmentedControl, Modal, ModalTitle } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
import { getSectionById } from '@/db/repositories/sections';
import {
  toDateKey,
  addDays,
  formatDisplayDate,
  getAttendanceForDay,
  setAttendanceStatus,
  markAllPresent,
  clearDay,
  copyFromPreviousDay,
  summarizeDay,
  summarizeMonthPerLearner,
  getAttendanceForMonth,
  monthLabel,
  daysInMonth,
} from '@/utils/attendance';
import {
  addNote,
  getNotesForLearner,
  formatNoteDate,
} from '@/utils/notes';
import type { AttendanceStatus, Learner, LearnerNote, Section } from '@/types';
import { ATTENDANCE_LABELS } from '@/types';

const STATUS_ORDER: AttendanceStatus[] = ['P', 'A', 'L', 'E', 'C'];
const STATUS_COLORS: Record<AttendanceStatus, { bg: string; fg: string }> = {
  P: { bg: '#e8f5e9', fg: '#2e7d32' },
  A: { bg: '#fdecea', fg: '#b71c1c' },
  L: { bg: '#fff3e0', fg: '#e65100' },
  E: { bg: '#e3f2fd', fg: '#1565c0' },
  C: { bg: '#f3e5f5', fg: '#6a1b9a' },
};

const DAY_COL_W = 26;
const NAME_COL_W = 120;
const TALLY_COL_W = 72;
const RATE_COL_W = 40;

function nextStatus(current: AttendanceStatus | undefined): AttendanceStatus | null {
  if (!current) return 'P';
  const idx = STATUS_ORDER.indexOf(current);
  return idx === STATUS_ORDER.length - 1 ? null : STATUS_ORDER[idx + 1];
}

export default function Attendance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [section, setSection] = useState<Section | null>(null);
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [dateKey, setDateKey] = useState(toDateKey());
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [, forceTick] = useState(0);

  // Quick note while taking attendance
  const [noteLearner, setNoteLearner] = useState<Learner | null>(null);
  const noteCategory: LearnerNote['category'] = 'other';
  const [noteText, setNoteText] = useState('');
  const [noteList, setNoteList] = useState<LearnerNote[]>([]);

  const load = useCallback(() => {
    if (id) setSection(getSectionById(id));
  }, [id]);

  useFocusEffect(load);

  // All hooks must run before any early return (Rules of Hooks).
  const monthDays = useMemo(
    () => daysInMonth(monthCursor.year, monthCursor.month),
    [monthCursor.year, monthCursor.month]
  );

  const monthRecords = useMemo(() => {
    if (!section) return [];
    return getAttendanceForMonth(section.id, monthCursor.year, monthCursor.month);
  }, [section, monthCursor.year, monthCursor.month]);

  const monthByLearnerDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const r of monthRecords) {
      map.set(`${r.learnerId}|${r.date}`, r.status);
    }
    return map;
  }, [monthRecords]);

  const openNoteModal = (learner: Learner) => {
    if (!section) return;
    setNoteLearner(learner);
    setNoteText('');
    setNoteList(getNotesForLearner(section.id, learner.id).slice(0, 5));
  };

  const saveNote = () => {
    if (!section || !noteLearner) return;
    addNote({
      sectionId: section.id,
      learnerId: noteLearner.id,
      category: noteCategory,
      text: noteText.trim() || undefined,
    });
    setNoteList(getNotesForLearner(section.id, noteLearner.id).slice(0, 5));
    setNoteText('');
    Alert.alert('Note saved', `Added for ${noteLearner.name}`);
  };

  if (!section) {
    return (
      <View style={styles.screen}>
        <Header title="Attendance" onBack={() => router.back()} />
      </View>
    );
  }

  const males = section.learners
    .filter((l) => l.gender === 'Male')
    .sort((a, b) => a.order - b.order);
  const females = section.learners
    .filter((l) => l.gender === 'Female')
    .sort((a, b) => a.order - b.order);
  const roster = [...males, ...females];

  const dayRecords = getAttendanceForDay(section.id, dateKey);
  const daySummary = summarizeDay(section.learners, dayRecords);
  const byLearner = new Map(dayRecords.map((r) => [r.learnerId, r.status]));

  const refresh = () => forceTick((n) => n + 1);

  const handleCycle = (learnerId: string) => {
    const current = byLearner.get(learnerId);
    const next = nextStatus(current);
    setAttendanceStatus(section.id, learnerId, dateKey, next);
    refresh();
  };

  const handleMarkAllPresent = () => {
    markAllPresent(section.id, dateKey, section.learners);
    refresh();
  };

  const handleClearDay = () => {
    Alert.alert('Clear this day?', `Removes all attendance marks for ${formatDisplayDate(dateKey)}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearDay(section.id, dateKey);
          refresh();
        },
      },
    ]);
  };

  const handleCopyYesterday = () => {
    const count = copyFromPreviousDay(section.id, dateKey, section.learners);
    refresh();
    Alert.alert(
      count > 0 ? 'Copied' : 'Nothing to copy',
      count > 0
        ? `Copied ${count} record(s) from the previous day.`
        : 'No attendance found for the previous day.'
    );
  };

  const monthStats = summarizeMonthPerLearner(section.learners, monthRecords);

  const renderLearnerRow = (l: Learner) => {
    const status = byLearner.get(l.id);
    const c = status ? STATUS_COLORS[status] : null;
    const noteCount = section ? getNotesForLearner(section.id, l.id).length : 0;
    return (
      <View key={l.id} style={styles.learnerRow}>
        <Pressable onPress={() => handleCycle(l.id)} style={styles.learnerMain}>
          <Text style={styles.learnerName} numberOfLines={1}>
            {l.order}. {l.name}
          </Text>
          <View style={[styles.statusChip, c ? { backgroundColor: c.bg } : styles.statusChipEmpty]}>
            <Text style={[styles.statusChipText, c ? { color: c.fg } : { color: colors.textMuted }]}>
              {status ?? '—'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => openNoteModal(l)}
          style={styles.noteBtn}
          accessibilityLabel={`Add note for ${l.name}`}
        >
          <Text style={styles.noteBtnText}>📝{noteCount > 0 ? ` ${noteCount}` : ''}</Text>
        </Pressable>
      </View>
    );
  };

  const renderMonthStatusCell = (learnerId: string, date: string) => {
    const s = monthByLearnerDate.get(`${learnerId}|${date}`);
    if (!s) {
      return (
        <View key={date} style={styles.monthDayCell}>
          <Text style={styles.monthDayDot}>·</Text>
        </View>
      );
    }
    const c = STATUS_COLORS[s];
    return (
      <View key={date} style={[styles.monthDayCell, { backgroundColor: c.bg }]}>
        <Text style={[styles.monthDayLetter, { color: c.fg }]}>{s}</Text>
      </View>
    );
  };

  const renderMonthGrid = () => {
    const tableWidth = NAME_COL_W + monthDays.length * DAY_COL_W + TALLY_COL_W + RATE_COL_W;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={{ minWidth: tableWidth }}>
          {/* Header */}
          <View style={[styles.monthRow, styles.monthHeader]}>
            <View style={[styles.monthNameCell, { backgroundColor: colors.surface }]}>
              <Text style={styles.monthHeaderText}>Learner</Text>
            </View>
            {monthDays.map((d) => (
              <View key={d} style={styles.monthDayCell}>
                <Text style={styles.monthHeaderDay}>{d.slice(-2)}</Text>
              </View>
            ))}
            <View style={styles.monthTallyCell}>
              <Text style={styles.monthHeaderText}>P/A/L/E/C</Text>
            </View>
            <View style={styles.monthRateCell}>
              <Text style={styles.monthHeaderText}>%</Text>
            </View>
          </View>

          {roster.map((l) => {
            const st = monthStats.find((s) => s.learnerId === l.id);
            return (
              <View key={l.id} style={styles.monthRow}>
                <View style={[styles.monthNameCell, { backgroundColor: colors.surface }]}>
                  <Text style={styles.monthNameText} numberOfLines={1}>
                    {l.name}
                  </Text>
                </View>
                {monthDays.map((d) => renderMonthStatusCell(l.id, d))}
                <View style={styles.monthTallyCell}>
                  <Text style={styles.monthTallyText}>
                    {st
                      ? `${st.present}/${st.absent}/${st.late}/${st.excused}/${st.cutting}`
                      : '—'}
                  </Text>
                </View>
                <View style={styles.monthRateCell}>
                  <Text style={styles.monthRateText}>
                    {st?.rate != null ? `${st.rate}%` : '—'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.screen}>
      <Header title={`Attendance — ${section.name}`} onBack={() => router.back()} />
      <DuplicateBanner section={section} />

      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SegmentedControl
          options={[
            { label: '📅 Daily', value: 'daily' as const },
            { label: '📊 Monthly', value: 'monthly' as const },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'daily' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <View style={styles.dateBar}>
            <Pressable onPress={() => setDateKey((d) => addDays(d, -1))} style={styles.dateArrow}>
              <Text style={styles.dateArrowText}>←</Text>
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.dateText}>{formatDisplayDate(dateKey)}</Text>
              {dateKey !== toDateKey() && (
                <Pressable onPress={() => setDateKey(toDateKey())}>
                  <Text style={styles.todayLink}>Jump to Today</Text>
                </Pressable>
              )}
            </View>
            <Pressable onPress={() => setDateKey((d) => addDays(d, 1))} style={styles.dateArrow}>
              <Text style={styles.dateArrowText}>→</Text>
            </Pressable>
          </View>

          <View style={styles.toolbarRow}>
            <Button label="Mark All Present" onPress={handleMarkAllPresent} style={{ flex: 1 }} />
            <Button
              label="Copy Yesterday"
              variant="secondary"
              onPress={handleCopyYesterday}
              style={{ flex: 1 }}
            />
          </View>
          <Button
            label="Clear Day"
            variant="danger"
            onPress={handleClearDay}
            style={{ marginTop: spacing.sm }}
          />

          <View style={styles.summaryStrip}>
            {(['P', 'A', 'L', 'E', 'C'] as AttendanceStatus[]).map((s) => (
              <View key={s} style={styles.summaryChip}>
                <Text style={[styles.summaryChipLetter, { color: STATUS_COLORS[s].fg }]}>{s}</Text>
                <Text style={styles.summaryChipCount}>
                  {s === 'P'
                    ? daySummary.present
                    : s === 'A'
                      ? daySummary.absent
                      : s === 'L'
                        ? daySummary.late
                        : s === 'E'
                          ? daySummary.excused
                          : daySummary.cutting}
                </Text>
              </View>
            ))}
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipLetter}>Rate</Text>
              <Text style={styles.summaryChipCount}>
                {daySummary.rate != null ? `${daySummary.rate}%` : '—'}
              </Text>
            </View>
          </View>

          <Text style={styles.legendText}>
            Tap name/status to cycle:{' '}
            {STATUS_ORDER.map((s) => `${s}=${ATTENDANCE_LABELS[s]}`).join(' → ')} → blank
            {'\n'}Tap 📝 to add a note for that learner
          </Text>

          <Text style={styles.groupHeading}>♂ Male ({males.length})</Text>
          <Card style={{ padding: 0, marginBottom: spacing.md }}>
            {males.length === 0 ? (
              <Text style={styles.emptyText}>No male learners.</Text>
            ) : (
              males.map(renderLearnerRow)
            )}
          </Card>

          <Text style={styles.groupHeading}>♀ Female ({females.length})</Text>
          <Card style={{ padding: 0 }}>
            {females.length === 0 ? (
              <Text style={styles.emptyText}>No female learners.</Text>
            ) : (
              females.map(renderLearnerRow)
            )}
          </Card>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <View style={styles.dateBar}>
            <Pressable
              onPress={() =>
                setMonthCursor((c) =>
                  c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }
                )
              }
              style={styles.dateArrow}
            >
              <Text style={styles.dateArrowText}>←</Text>
            </Pressable>
            <Text style={[styles.dateText, { flex: 1, textAlign: 'center' }]}>
              {monthLabel(monthCursor.year, monthCursor.month)}
            </Text>
            <Pressable
              onPress={() =>
                setMonthCursor((c) =>
                  c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }
                )
              }
              style={styles.dateArrow}
            >
              <Text style={styles.dateArrowText}>→</Text>
            </Pressable>
          </View>

          {roster.length === 0 ? (
            <Card style={{ alignItems: 'center', padding: spacing.lg }}>
              <Text style={{ color: colors.textMuted }}>No learners in this section yet.</Text>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>{renderMonthGrid()}</Card>
          )}

          <View style={styles.monthLegend}>
            {STATUS_ORDER.map((s) => (
              <Text key={s} style={styles.monthLegendItem}>
                <Text style={{ fontWeight: '700', color: STATUS_COLORS[s].fg }}>{s}</Text>
                {' = '}
                {ATTENDANCE_LABELS[s]}
              </Text>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Quick note modal while taking attendance */}
      <Modal visible={!!noteLearner} onClose={() => setNoteLearner(null)} maxWidth={420}>
        <ModalTitle>Note — {noteLearner?.name ?? ''}</ModalTitle>
        <Text style={styles.noteModalHint}>
          Add an observation while taking attendance. Notes also appear on the Student Report.
        </Text>

        <TextInput
          style={styles.noteInput}
          placeholder="Optional details…"
          placeholderTextColor={colors.textMuted}
          value={noteText}
          onChangeText={setNoteText}
          multiline
        />

        <Button label="Save note" onPress={saveNote} style={{ marginTop: spacing.sm }} />

        {noteList.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.noteRecentTitle}>Recent notes</Text>
            {noteList.map((n) => (
              <View key={n.id} style={styles.noteRecentRow}>
                <Text style={{ fontSize: 12, color: colors.text }}>{n.text || '(no detail)'}</Text>
                <Text style={styles.noteRecentDate}>{formatNoteDate(n.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  dateBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  dateArrow: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowText: { fontSize: 18, color: colors.maroon },
  dateText: { fontSize: 15, fontWeight: '700', color: colors.text },
  todayLink: { fontSize: 12, color: colors.maroon, marginTop: 2 },
  toolbarRow: { flexDirection: 'row', gap: 8 },
  summaryStrip: { flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' },
  summaryChip: {
    flex: 1,
    minWidth: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 6,
    alignItems: 'center',
  },
  summaryChipLetter: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  summaryChipCount: { fontSize: 14, fontWeight: '700', color: colors.text },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  groupHeading: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textMuted, padding: spacing.sm },
  learnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  learnerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 6,
  },
  learnerName: { fontSize: 13, color: colors.text, flex: 1, marginRight: 8 },
  statusChip: {
    width: 36,
    height: 30,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipEmpty: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipText: { fontSize: 13, fontWeight: '700' },
  noteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  noteBtnText: { fontSize: 14 },
  noteModalHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  noteRecentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
  },
  noteRecentRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  noteRecentDate: { fontSize: 10, color: colors.textMuted, marginTop: 2 },


  // Monthly grid
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 32,
  },
  monthHeader: { backgroundColor: colors.cream },
  monthNameCell: {
    width: NAME_COL_W,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: 'center',
  },
  monthNameText: { fontSize: 11, fontWeight: '500', color: colors.text },
  monthHeaderText: { fontSize: 10, fontWeight: '700', color: colors.text },
  monthHeaderDay: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  monthDayCell: {
    width: DAY_COL_W,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayDot: { fontSize: 10, color: colors.textMuted },
  monthDayLetter: { fontSize: 11, fontWeight: '700' },
  monthTallyCell: {
    width: TALLY_COL_W,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTallyText: { fontSize: 10, color: colors.textMuted },
  monthRateCell: {
    width: RATE_COL_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRateText: { fontSize: 11, fontWeight: '700', color: colors.maroon },
  monthLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: spacing.md,
  },
  monthLegendItem: { fontSize: 12, color: colors.textMuted },
});
