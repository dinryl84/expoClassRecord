import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/Header';
import { Button, Card } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
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
        {SUBJECT_TYPE_LABELS.map(({ type, short }) => {
          const p = weightPct[type];
          const sum = p.written + p.performance + p.quarterly;
          const sumOk = Math.abs(sum - 100) <= 0.5;
          return (
            <Card key={type} style={{ marginBottom: spacing.sm }}>
              <Text style={styles.subjectTitle}>{short}</Text>
              <View style={styles.pctRow}>
                <PctField label="Written Works" value={p.written} onChangeText={(t) => updateField(type, 'written', t)} />
                <PctField label="Perf. Tasks" value={p.performance} onChangeText={(t) => updateField(type, 'performance', t)} />
                <PctField label="Summative" value={p.quarterly} onChangeText={(t) => updateField(type, 'quarterly', t)} />
              </View>
              <Text style={[styles.sumText, !sumOk && { color: colors.danger }]}>Total: {sum.toFixed(1)}%</Text>
            </Card>
          );
        })}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
          <Button label="Reset to DepEd Defaults" variant="secondary" onPress={handleReset} style={{ flex: 1 }} />
          <Button label={saved ? 'Saved ✓' : 'Save'} onPress={handleSave} style={{ flex: 1 }} />
        </View>
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
  subjectTitle: { fontWeight: '700', color: colors.maroon, fontSize: 14, marginBottom: spacing.sm },
  pctRow: { flexDirection: 'row', gap: 8 },
  pctLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  pctInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
  },
  pctInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: colors.text },
  pctSign: { color: colors.textMuted, fontSize: 12 },
  sumText: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'right' },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
});
