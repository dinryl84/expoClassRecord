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

// The PWA writes this whole palette inline in pages/Attendance.tsx:31-37 and
// none of the six colours has a theme token, so it stays a local const:
// `bg` tints the learner row / the monthly month cell, `fg` is that cell's
// text, `border` fills the active status button. (The P/A/L borders happen to
// equal --color-green / --color-primary / --color-accent but are literal there.)
const STATUS_COLORS: Record<AttendanceStatus, { bg: string; fg: string; border: string }> = {
  P: { bg: '#e8f5e9', fg: '#2e7d32', border: '#486C2F' },
  A: { bg: '#fdecea', fg: '#b71c1c', border: '#8B2626' },
  L: { bg: '#fff3e0', fg: '#e65100', border: '#EF6905' },
  E: { bg: '#e3f2fd', fg: '#1565c0', border: '#1976d2' },
  C: { bg: '#f3e5f5', fg: '#6a1b9a', border: '#7b1fa2' },
};

// PWA active status button label colour: `color: active ? '#fff' : c.fg`
// (pages/Attendance.tsx:252). No theme token, so it lives here.
const STATUS_ACTIVE_TEXT = '#FFFFFF';

// PWA monthly table column widths (pages/Attendance.tsx:643-694): each day
// column is a fixed 22px, the sticky learner column is minWidth 120, and the
// tally/rate columns are content-sized (padding 6px 8px) so we give them a
// rough fixed width to keep the rows aligned.
const DAY_COL_W = 22;
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
      // PWA row background: `status ? STATUS_COLORS[status].bg : transparent`
      // (pages/Attendance.tsx:210).
      <View key={l.id} style={[styles.learnerRow, c ? { backgroundColor: c.bg } : null]}>
        <Pressable onPress={() => handleCycle(l.id)} style={styles.learnerMain}>
          <Text style={styles.learnerName} numberOfLines={1}>
            {l.order}. {l.name}
          </Text>
          {/* PWA renders the set status as the filled/active status button —
              background+border = STATUS_COLORS[s].border, white label — and an
              unset learner has no button (pages/Attendance.tsx:246-260). */}
          <View
            style={[
              styles.statusChip,
              c ? { backgroundColor: c.border, borderColor: c.border } : styles.statusChipEmpty,
            ]}
          >
            <Text
              style={[styles.statusChipText, { color: c ? STATUS_ACTIVE_TEXT : colors.textMuted }]}
            >
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
          {/* PWA thead (pages/Attendance.tsx:643-695): a 2px bottom rule, a
              sticky white learner column, 10/600 day numbers, 11px tally/% th. */}
          <View style={[styles.monthRow, styles.monthHeader]}>
            <View style={[styles.monthNameCell, { backgroundColor: colors.surface }]}>
              <Text style={styles.monthHeaderName}>Learner</Text>
            </View>
            {monthDays.map((d) => (
              <View key={d} style={styles.monthDayCell}>
                <Text style={styles.monthHeaderDay}>{d.slice(-2)}</Text>
              </View>
            ))}
            <View style={styles.monthTallyCell}>
              <Text style={styles.monthHeaderCell}>P/A/L/E/C</Text>
            </View>
            <View style={styles.monthRateCell}>
              <Text style={styles.monthHeaderCell}>%</Text>
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
          {/* Date nav — PWA `.card` (padding 10px 12px) with two compact
              `.btn btn-outline` arrows and the accent "Jump to Today" link
              (pages/Attendance.tsx:391-438). */}
          <Card style={styles.navBar}>
            <Button
              variant="outline"
              size="sm"
              label="‹"
              onPress={() => setDateKey((d) => addDays(d, -1))}
            />
            <View style={styles.navCenter}>
              <Text style={styles.dateText}>{formatDisplayDate(dateKey)}</Text>
              {dateKey !== toDateKey() && (
                <Pressable onPress={() => setDateKey(toDateKey())}>
                  <Text style={styles.todayLink}>Jump to Today</Text>
                </Pressable>
              )}
            </View>
            <Button
              variant="outline"
              size="sm"
              label="›"
              onPress={() => setDateKey((d) => addDays(d, 1))}
            />
          </Card>

          {/* Summary strip — PWA `.card` grid `repeat(6, 1fr)` (padding 12px 6px):
              the big number is the count, tinted by that status; the small
              caption is the status letter / "Rate" (pages/Attendance.tsx:452-501). */}
          <Card style={styles.summaryStrip}>
            {(
              [
                ['P', daySummary.present, STATUS_COLORS.P.fg],
                ['A', daySummary.absent, STATUS_COLORS.A.fg],
                ['L', daySummary.late, STATUS_COLORS.L.fg],
                ['E', daySummary.excused, STATUS_COLORS.E.fg],
                ['C', daySummary.cutting, STATUS_COLORS.C.fg],
              ] as const
            ).map(([label, count, fg]) => (
              <View key={label} style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: fg }]}>{count}</Text>
                <Text style={styles.summaryCaption}>{label}</Text>
              </View>
            ))}
            <View style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: colors.maroon }]}>
                {daySummary.rate != null ? `${daySummary.rate}%` : '—'}
              </Text>
              <Text style={styles.summaryCaption}>Rate</Text>
            </View>
          </Card>

          {/* Bulk actions — PWA compact buttons in a single wrapping row
              (pages/Attendance.tsx:504-544). The two outline buttons are the
              compact `.btn btn-outline` (Button size="sm"); "Clear Day" also
              overrides to var(--color-danger) (Button variant="danger"). */}
          <View style={styles.actionRow}>
            <Button size="sm" label="Mark All Present" onPress={handleMarkAllPresent} />
            <Button size="sm" variant="outline" label="Copy Yesterday" onPress={handleCopyYesterday} />
            <Button size="sm" variant="danger" label="Clear Day" onPress={handleClearDay} />
          </View>

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

          <Text style={styles.legendText}>
            Tap name/status to cycle:{' '}
            {STATUS_ORDER.map((s) => `${s}=${ATTENDANCE_LABELS[s]}`).join(' → ')} → blank
            {'\n'}Tap 📝 to add a note for that learner
          </Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {/* Month nav — same PWA `.card` nav bar as the daily date bar
              (pages/Attendance.tsx:588-618). */}
          <Card style={styles.navBar}>
            <Button
              variant="outline"
              size="sm"
              label="‹"
              onPress={() =>
                setMonthCursor((c) =>
                  c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }
                )
              }
            />
            <Text style={[styles.dateText, styles.navCenterText]}>
              {monthLabel(monthCursor.year, monthCursor.month)}
            </Text>
            <Button
              variant="outline"
              size="sm"
              label="›"
              onPress={() =>
                setMonthCursor((c) =>
                  c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }
                )
              }
            />
          </Card>

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

  // PWA nav bar (both the daily date nav and the monthly month nav): a `.card`
  // with padding 10px 12px, a `gap:8` row, marginBottom 12 (Attendance.tsx:391,589).
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  navCenter: { flex: 1, alignItems: 'center' },
  navCenterText: { flex: 1, textAlign: 'center' },
  dateText: { fontSize: 15, fontWeight: '700', color: colors.text },
  // PWA "Jump to Today": fontSize 12 / 600, colour var(--color-accent).
  todayLink: { fontSize: 12, fontWeight: '600', color: colors.orange, marginTop: 2 },

  // PWA summary strip: a `.card` laid out as 6 equal columns, `gap:4`,
  // `padding:12px 6px`, marginBottom 14 (pages/Attendance.tsx:452-461).
  summaryStrip: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  // The count: fontSize 17 / 800. The caption: fontSize 10, colour text-muted.
  summaryValue: { fontSize: 17, fontWeight: '800' },
  summaryCaption: { fontSize: 10, color: colors.textMuted },

  // PWA bulk-actions row: `gap:8; marginBottom:16; flexWrap:wrap` (Attendance.tsx:504-510).
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' },

  // PWA legend text: fontSize 12, colour text-muted, marginTop 8 (Attendance.tsx:566-574).
  legendText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },

  // PWA group heading is `<h3 style={{ fontSize:13, color:var(--color-primary),
  //   marginBottom:6, fontWeight:700 }}>` (pages/Attendance.tsx:272-279).
  groupHeading: { fontSize: 13, fontWeight: '700', color: colors.maroon, marginBottom: 6 },
  emptyText: { fontSize: 13, color: colors.textMuted, padding: spacing.sm },

  // PWA learner row: `alignItems:center; gap:8; padding:10px 12px; borderBottom
  // 1px solid var(--color-border)` (pages/Attendance.tsx:202-211).
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
  // PWA name: fontSize 14 / 500, single-line ellipsis (pages/Attendance.tsx:223-234).
  learnerName: { fontSize: 14, fontWeight: '500', color: colors.text, flex: 1, marginRight: 8 },
  // PWA status button: width/height 34, radius 8, font 13 / 700
  // (pages/Attendance.tsx:246-256).
  statusChip: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No status set → PWA unselected button look (surface bg, 1px border).
  statusChipEmpty: {
    backgroundColor: colors.surface,
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

  // Monthly grid — PWA table (pages/Attendance.tsx:636-748)
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 30,
  },
  // PWA gives the header ths a 2px bottom rule on the plain white surface.
  monthHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  monthNameCell: {
    width: NAME_COL_W,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  // PWA name cell inherits the table's 12px, weight 500 (Attendance.tsx:702-718).
  monthNameText: { fontSize: 12, fontWeight: '500', color: colors.text },
  // "Learner" th inherits the table's 12px and default bold weight.
  monthHeaderName: { fontSize: 12, fontWeight: '700', color: colors.text },
  // tally / % th: fontSize 11 (pages/Attendance.tsx:676-694).
  monthHeaderCell: { fontSize: 11, color: colors.text },
  monthHeaderDay: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  // PWA day cell: width/minWidth 22, height 28 (pages/Attendance.tsx:290-325).
  monthDayCell: {
    width: DAY_COL_W,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayDot: { fontSize: 10, color: colors.textMuted },
  monthDayLetter: { fontSize: 11, fontWeight: '700' },
  monthTallyCell: {
    width: TALLY_COL_W,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTallyText: { fontSize: 11, color: colors.textMuted },
  monthRateCell: {
    width: RATE_COL_W,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRateText: { fontSize: 12, fontWeight: '700', color: colors.maroon },
  // PWA monthly legend: marginTop 12, fontSize 12, gap 10 (pages/Attendance.tsx:752-760).
  monthLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  monthLegendItem: { fontSize: 12, color: colors.textMuted },
});
