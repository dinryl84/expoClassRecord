import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/Header';
import { Button, Card, Field } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { getSchoolInfo, putSchoolInfo } from '@/db/repositories/schoolInfo';
import type { SchoolInfo } from '@/types';

const FIELDS: { key: keyof SchoolInfo; label: string }[] = [
  { key: 'region', label: 'Region' },
  { key: 'division', label: 'Division' },
  { key: 'schoolId', label: 'School ID' },
  { key: 'schoolName', label: 'School Name' },
  { key: 'schoolYear', label: 'School Year' },
  { key: 'teacher', label: 'Teacher Name' },
  { key: 'track', label: 'Track' },
];

export default function SchoolSettings() {
  const [info, setInfo] = useState<SchoolInfo>(getSchoolInfo());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    putSchoolInfo(info);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setTermDate = (term: 1 | 2 | 3, edge: 'start' | 'end', value: string) => {
    setInfo((prev) => ({
      ...prev,
      termDates: {
        ...prev.termDates,
        [term]: {
          start: edge === 'start' ? value : prev.termDates?.[term]?.start ?? '',
          end: edge === 'end' ? value : prev.termDates?.[term]?.end ?? '',
        },
      },
    }));
  };

  return (
    <View style={styles.screen}>
      <Header title="School Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card>
          <Text style={styles.cardTitle}>School Info</Text>
          {FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              value={(info[f.key] as string) ?? ''}
              onChangeText={(v) => setInfo((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}

          <View style={styles.termSection}>
            <Text style={styles.termTitle}>Term dates</Text>
            <Text style={styles.termHelp}>
              Used to filter attendance and reports by Term 1 / 2 / 3. Leave blank if unused.
              Format: YYYY-MM-DD.
            </Text>
            {([1, 2, 3] as const).map((t) => {
              const range = info.termDates?.[t] || { start: '', end: '' };
              return (
                <View key={t} style={{ marginBottom: spacing.sm }}>
                  <Text style={styles.termLabel}>Term {t}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Start"
                        value={range.start}
                        onChangeText={(v) => setTermDate(t, 'start', v)}
                        placeholder="YYYY-MM-DD"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="End"
                        value={range.end}
                        onChangeText={(v) => setTermDate(t, 'end', v)}
                        placeholder="YYYY-MM-DD"
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <Button label={saved ? 'Saved ✓' : 'Save'} onPress={handleSave} style={{ marginTop: spacing.sm }} />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.cardTitle}>Grade Weights</Text>
          <Text style={styles.termHelp}>
            Written Works / Performance Tasks / Summative weights per subject type. DepEd defaults
            apply unless you override them here.
          </Text>
          <Button label="Edit Grade Weights →" variant="secondary" onPress={() => router.push('/grade-weights')} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.maroon, marginBottom: spacing.md },
  termSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  termTitle: { fontWeight: '600', marginBottom: 4, color: colors.text },
  termHelp: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  termLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: colors.text },
});
