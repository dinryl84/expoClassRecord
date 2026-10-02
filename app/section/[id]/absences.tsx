import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, BackHandler } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/Header';
import { Card, Field } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
import { getSectionById } from '@/db/repositories/sections';
import { getSchoolInfo } from '@/db/repositories/schoolInfo';
import { getLearnerAttendanceMonths, type AttendancePeriodFilter } from '@/utils/attendance';
import {
  LISTED_STATUSES,
  formatDayLabel,
  getLearnerNonPresentDays,
  monthName,
} from '@/utils/absenceList';
import { ATTENDANCE_LABELS, type AttendanceStatus, type Learner, type Section } from '@/types';

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  P: colors.green,
  A: colors.maroon,
  L: colors.orange,
  E: colors.info,
  C: colors.textMuted,
};

export default function Absences() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [section, setSection] = useState<Section | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'all' | '1' | '2' | '3'>('all');
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);

  const load = useCallback(() => {
    if (id) setSection(getSectionById(id));
  }, [id]);
  useFocusEffect(load);

  // Android back button: from a learner's detail go back to the list first.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (selectedId) {
          setSelectedId(null);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [selectedId])
  );

  const roster: Learner[] = useMemo(() => {
    if (!section) return [];
    const males = section.learners.filter((l) => l.gender === 'Male').sort((a, b) => a.order - b.order);
    const females = section.learners.filter((l) => l.gender === 'Female').sort((a, b) => a.order - b.order);
    return [...males, ...females];
  }, [section]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? roster.filter((l) => l.name.toLowerCase().includes(q)) : roster;
  }, [roster, search]);

  const termDates = getSchoolInfo().termDates ?? {};
  const learner = roster.find((l) => l.id === selectedId) ?? null;

  const period: AttendancePeriodFilter = useMemo(() => {
    if (month) return { mode: 'month', year: month.year, month: month.month };
    if (mode === 'all') return { mode: 'all' };
    const term = Number(mode) as 1 | 2 | 3;
    const range = termDates[term];
    return { mode: 'term', term, start: range?.start ?? '', end: range?.end ?? '' };
  }, [mode, month, termDates]);

  if (!section) {
    return (
      <View style={styles.screen}>
        <Header title="Absences" onBack={() => router.back()} />
      </View>
    );
  }

  const selectLearner = (l: Learner) => {
    setSelectedId(l.id);
    setMode('all');
    setMonth(null);
  };

  // ---------------------------------------------------------------- list view
  if (!learner) {
    return (
      <View style={styles.screen}>
        <Header title={`Absences — ${section.name}`} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: spacing.md }} keyboardShouldPersistTaps="handled">
          <Field
            value={search}
            onChangeText={setSearch}
            placeholder="Search learner name"
            accessibilityLabel="Search learner"
            autoCapitalize="none"
          />
          {roster.length === 0 ? (
            <Text style={styles.emptyText}>No learners in this section yet.</Text>
          ) : filteredRoster.length === 0 ? (
            <Text style={styles.emptyText}>No learner matches "{search.trim()}".</Text>
          ) : (
            <Card style={{ padding: 0 }}>
              {filteredRoster.map((l, idx) => (
                <Pressable
                  key={l.id}
                  onPress={() => selectLearner(l)}
                  style={[
                    styles.learnerRow,
                    idx < filteredRoster.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                  ]}
                >
                  <Text style={styles.learnerName}>
                    <Text style={{ color: l.gender === 'Male' ? colors.maroon : colors.orange }}>
                      {l.gender === 'Male' ? '♂ ' : '♀ '}
                    </Text>
                    {l.name}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---------------------------------------------------------- one learner view
  const records = getLearnerNonPresentDays(section.id, learner.id, period);
  const months = getLearnerAttendanceMonths(section.id, learner.id);
  const years = new Set(records.map((r) => r.date.slice(0, 4)));
  const withYear = years.size > 1;
  const termMissingDates =
    period.mode === 'term' && (!period.start || !period.end);

  const periodLabel = month
    ? `${monthName(month.month)} ${month.year}`
    : mode === 'all'
      ? 'All dates'
      : `Term ${mode}`;

  return (
    <View style={styles.screen}>
      <Header title={learner.name} subtitle="Absences" onBack={() => setSelectedId(null)} />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <View style={styles.chipRow}>
          {(['all', '1', '2', '3'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMode(m);
                setMonth(null);
              }}
              style={[styles.modeChip, mode === m && !month && styles.modeChipActive]}
            >
              <Text style={[styles.modeChipText, mode === m && !month && styles.modeChipTextActive]}>
                {m === 'all' ? 'All' : `T${m}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {months.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => setMonth(null)}
                style={[styles.monthChip, !month && styles.monthChipActive]}
              >
                <Text style={[styles.monthChipText, !month && styles.monthChipTextActive]}>All months</Text>
              </Pressable>
              {months.map((m) => {
                const active = month?.year === m.year && month?.month === m.month;
                return (
                  <Pressable
                    key={`${m.year}-${m.month}`}
                    onPress={() => setMonth(m)}
                    style={[styles.monthChip, active && styles.monthChipActive]}
                  >
                    <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>
                      {monthName(m.month).slice(0, 3)} {m.year}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        <Text style={styles.periodLabel}>Showing: {periodLabel}</Text>

        {termMissingDates && (
          <Card style={styles.noteCard}>
            <Text style={styles.noteText}>
              No start and end dates are set for Term {mode}. Set them under School Info to filter by term.
            </Text>
          </Card>
        )}

        {!termMissingDates && records.length === 0 && (
          <Card>
            <Text style={styles.emptyText}>
              No absent, late, excused or cutting days recorded for this period.
            </Text>
          </Card>
        )}

        {LISTED_STATUSES.map((status) => {
          const days = records.filter((r) => r.status === status);
          if (days.length === 0) return null;
          return (
            <Card key={status} style={{ marginBottom: spacing.sm }}>
              <Text style={[styles.statusHeading, { color: STATUS_COLOR[status] }]}>
                {ATTENDANCE_LABELS[status]} — {days.length} day{days.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.dayList}>
                {days.map((r) => formatDayLabel(r.date, withYear)).join(', ')}
              </Text>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  emptyText: { fontSize: 13, color: colors.textMuted },
  learnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  learnerName: { fontSize: 16, color: colors.text, flexShrink: 1 },
  chevron: { fontSize: 20, color: colors.textMuted },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  modeChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.maroon,
    backgroundColor: colors.surface,
  },
  modeChipActive: { backgroundColor: colors.maroon },
  modeChipText: { fontSize: 12, fontWeight: '700', color: colors.maroon },
  modeChipTextActive: { color: '#fff' },
  monthChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  monthChipActive: { borderColor: colors.maroon, backgroundColor: colors.cream },
  monthChipText: { fontSize: 11, color: colors.textMuted },
  monthChipTextActive: { color: colors.maroon, fontWeight: '700' },
  periodLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  noteCard: { backgroundColor: colors.errorBg, marginBottom: spacing.sm },
  noteText: { fontSize: 13, color: colors.maroon },
  statusHeading: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  dayList: { fontSize: 15, color: colors.text, lineHeight: 22 },
});
