import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/Header';
import { Button, Card, Field } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
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

/**
 * The PWA draws its Start/End term-date inputs with a small 11px muted `<label>`
 * above the `.input` box (SchoolSettings.tsx ~lines 725 / 743). The shared `Field`
 * widget uses a 13px/600 label, so we reproduce the PWA's smaller label here and
 * mirror the `.input` box inline.
 */
function DateField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.dateCol}>
      <Text style={styles.dateLabel}>{label}</Text>
      <TextInput
        style={styles.dateInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />
    </View>
  );
}

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
          {/* PWA `h2` card heading: 15px / bold / primary, marginBottom 14 */}
          <Text style={styles.cardTitle}>School Info</Text>
          {FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              value={(info[f.key] as string) ?? ''}
              onChangeText={(v) => setInfo((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}

          {/* PWA "term dates" block: marginTop 8, paddingTop 14, 1px top border, marginBottom 14 */}
          <View style={styles.termSection}>
            <Text style={styles.termTitle}>Term dates</Text>
            <Text style={styles.termHelp}>
              Used to filter attendance and reports by Term 1 / 2 / 3. Leave blank if unused.
              Format: YYYY-MM-DD.
            </Text>
            {([1, 2, 3] as const).map((t) => {
              const range = info.termDates?.[t] || { start: '', end: '' };
              return (
                <View key={t} style={styles.termRow}>
                  <Text style={styles.termLabel}>Term {t}</Text>
                  <View style={styles.termInputs}>
                    <DateField label="Start" value={range.start} onChangeText={(v) => setTermDate(t, 'start', v)} />
                    <DateField label="End" value={range.end} onChangeText={(v) => setTermDate(t, 'end', v)} />
                  </View>
                </View>
              );
            })}
          </View>

          <Button label={saved ? 'Saved ✓' : 'Save'} onPress={handleSave} style={{ marginTop: spacing.sm }} />
        </Card>

        {/* PWA footnote printed under the School Info card (SchoolSettings.tsx ~line 774) */}
        <Text style={styles.footnote}>School info appears on the exported Excel file.</Text>

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
  // PWA `h2` card headings (School Info / Grade Weights): 15px / bold / primary
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.maroon, marginBottom: 14 },
  termSection: {
    marginTop: spacing.sm,
    marginBottom: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // PWA "Term dates" sub-heading: default size (16px) / 600, marginBottom 4
  termTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  termHelp: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  termRow: { marginBottom: 12 },
  termLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  termInputs: { flexDirection: 'row', gap: 8 },
  dateCol: { flex: 1 },
  dateLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  // PWA `.input`: 1.5px border, radius 8, padding 12/14, 15px text
  dateInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  footnote: { fontSize: 12, color: colors.textMuted, marginTop: 12 },
});
