import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/Header';
import { Button, Card } from '@/components/ui';
import { colors, radii, spacing, tints } from '@/theme/theme';
import { SUBJECT_WEIGHTS } from '@/types';
import type { SubjectType, Weights } from '@/types';
import { getWeights, setCustomWeights, cloneDefaultWeights } from '@/utils/grades';

const SUBJECT_TYPE_LABELS: { type: SubjectType; short: string }[] = [
  { type: 'Core Subject (All Tracks)', short: 'Core Subject (All Tracks)' },
  { type: 'Academic Elective (All Other Electives)', short: 'Academic Elective (Other)' },
  {
    type: 'Academic Elective (Field Experience / Exposure, and Sports and Arts)',
    short: 'Academic Elective (Field / Sports / Arts)',
  },
  { type: 'TechPro Elective (All Other Electives)', short: 'TechPro Elective (Other)' },
  { type: 'TechPro Elective (Work Immersion)', short: 'TechPro Elective (Work Immersion)' },
];

type PctWeights = { written: number; performance: number; quarterly: number };

function toPct(w: Weights): PctWeights {
  return {
    written: Math.round(w.written * 1000) / 10,
    performance: Math.round(w.performance * 1000) / 10,
    quarterly: Math.round(w.quarterly * 1000) / 10,
  };
}

function fromPct(p: PctWeights): Weights {
  return { written: p.written / 100, performance: p.performance / 100, quarterly: p.quarterly / 100 };
}

function initialPctMap(): Record<SubjectType, PctWeights> {
  const init = {} as Record<SubjectType, PctWeights>;
  for (const { type } of SUBJECT_TYPE_LABELS) init[type] = toPct(getWeights(type));
  return init;
}

export default function GradeWeights() {
  const [weightPct, setWeightPct] = useState<Record<SubjectType, PctWeights>>(initialPctMap);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const updateField = (type: SubjectType, field: keyof PctWeights, text: string) => {
    const value = text === '' ? 0 : Number(text);
    setWeightPct((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
    setError(null);
    setSaved(false);
  };

  const validate = (): string | null => {
    for (const { type, short } of SUBJECT_TYPE_LABELS) {
      const p = weightPct[type];
      const sum = p.written + p.performance + p.quarterly;
      if (Math.abs(sum - 100) > 0.5) return `${short}: weights sum to ${sum.toFixed(1)}% (must be 100%).`;
      if (p.written < 0 || p.performance < 0 || p.quarterly < 0) return `${short}: weights cannot be negative.`;
    }
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const overrides: Partial<Record<SubjectType, Weights>> = {};
    for (const { type } of SUBJECT_TYPE_LABELS) overrides[type] = fromPct(weightPct[type]);
    setCustomWeights(overrides);
    setError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setCustomWeights(null);
    const defaults = cloneDefaultWeights();
    const next = {} as Record<SubjectType, PctWeights>;
    for (const { type } of SUBJECT_TYPE_LABELS) next[type] = toPct(defaults[type]);
    setWeightPct(next);
    setError(null);
    setSaved(false);
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Grade Weights"
        subtitle="DepEd defaults — override only if your school uses different weights"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card>
          {/* PWA description sentence printed under the Grade Weights heading (line ~559) */}
          <Text style={styles.intro}>
            Customize Written Works (WW), Performance Tasks (PT), and Quarterly Assessment (QA)
            weights per subject type. Values are percentages and must total 100% for each type.
            Use Save to apply them everywhere (live grades, reports, export).
          </Text>

          {SUBJECT_TYPE_LABELS.map(({ type, short }) => {
            const p = weightPct[type];
            const sum = p.written + p.performance + p.quarterly;
            const sumOk = Math.abs(sum - 100) <= 0.5;
            return (
              // PWA draws each subject type as a bottom-bordered row (line ~571)
              <View key={type} style={styles.subjectRow}>
                <View style={styles.subjectHead}>
                  <Text style={styles.subjectTitle}>{short}</Text>
                  <Text style={[styles.totalText, !sumOk && { color: colors.dangerAlt }]}>
                    Total {sum.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.pctRow}>
                  <PctField label="Written Works" value={p.written} onChangeText={(t) => updateField(type, 'written', t)} />
                  <PctField label="Perf. Tasks" value={p.performance} onChangeText={(t) => updateField(type, 'performance', t)} />
                  <PctField label="Summative" value={p.quarterly} onChangeText={(t) => updateField(type, 'quarterly', t)} />
                </View>
                <Text style={styles.defaultText}>
                  DepEd default: WW {(SUBJECT_WEIGHTS[type].written * 100).toFixed(0)}% · PT{' '}
                  {(SUBJECT_WEIGHTS[type].performance * 100).toFixed(0)}% · QA{' '}
                  {(SUBJECT_WEIGHTS[type].quarterly * 100).toFixed(0)}%
                </Text>
              </View>
            );
          })}

          {/* PWA weights error box: 12px #9c2b2b on rgba(156,43,43,0.08), radius 8 (line ~650) */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button label={saved ? 'Saved ✓' : 'Save'} onPress={handleSave} style={{ flex: 1 }} />
            <Button label="Reset to DepEd Defaults" variant="secondary" onPress={handleReset} style={{ flex: 1 }} />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function PctField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: number;
  onChangeText: (t: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.pctLabel}>{label}</Text>
      <View style={styles.pctInputWrap}>
        <TextInput
          style={styles.pctInput}
          keyboardType="numeric"
          value={String(value)}
          onChangeText={onChangeText}
        />
        <Text style={styles.pctSign}>%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  intro: { fontSize: 12, color: colors.textMuted, marginBottom: 14 },
  // PWA subject-type row: marginBottom 16, paddingBottom 14, 1px bottom border
  subjectRow: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // PWA header row: name (13px/600) left, "Total X%" (11px/700) right
  subjectHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  subjectTitle: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
  totalText: { fontSize: 11, fontWeight: '700', color: colors.green },
  pctRow: { flexDirection: 'row', gap: 8 },
  pctLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  // PWA `.input`: 1.5px border, radius 8, 15px text; horizontal padding 14
  pctInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
  },
  pctInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  pctSign: { color: colors.textMuted, fontSize: 15 },
  defaultText: { fontSize: 10, color: colors.textMuted, marginTop: 6 },
  errorBox: {
    backgroundColor: tints.dangerAlt08,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: { fontSize: 12, color: colors.dangerAlt },
  actions: { flexDirection: 'row', gap: 8 },
});
