import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/Header';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { Button, Card, Modal, ModalTitle, Field, SegmentedControl } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { getSectionById, putSection } from '@/db/repositories/sections';
import { parseBulkNames, splitByGender } from '@/utils/bulkUpload';
import { reconcileLearners } from '@/utils/learnerMatch';
import { uuid } from '@/utils/id';
import type { Learner, Section } from '@/types';

export default function Learners() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [section, setSection] = useState<Section | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkGender, setBulkGender] = useState<'Male' | 'Female'>('Male');
  const [manualName, setManualName] = useState('');
  const [manualGender, setManualGender] = useState<'Male' | 'Female'>('Male');

  const load = useCallback(() => {
    if (id) setSection(getSectionById(id));
  }, [id]);

  useFocusEffect(load);

  if (!section) {
    return (
      <View style={styles.screen}>
        <Header title="Learners" onBack={() => router.back()} />
      </View>
    );
  }

  const males = section.learners.filter((l) => l.gender === 'Male').sort((a, b) => a.order - b.order);
  const females = section.learners.filter((l) => l.gender === 'Female').sort((a, b) => a.order - b.order);

  const saveLearners = (newLearners: Learner[]) => {
    putSection({ ...section, learners: newLearners });
    load();
  };

  const handleBulkUpload = () => {
    const parsed = parseBulkNames(bulkText, bulkGender);
    if (parsed.length === 0) {
      Alert.alert('No valid names found', 'Please check the format.');
      return;
    }
    // Keep existing opposite gender, replace same gender — but keep the IDs
    // of names that already exist, so re-pasting the roster doesn't orphan
    // their attendance, notes, and other-subject scores (all keyed by id).
    const opposite = section.learners.filter((l) => l.gender !== bulkGender);
    const existingSameGender = section.learners.filter((l) => l.gender === bulkGender);
    const reconciled = reconcileLearners(existingSameGender, parsed);
    const combined = [...opposite, ...reconciled];
    const { male, female } = splitByGender(combined);
    saveLearners([...male, ...female]);
    setBulkText('');
    setShowBulk(false);
  };

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    const learner: Learner = {
      id: uuid(),
      name: manualName.trim().toUpperCase(),
      gender: manualGender,
      order: (manualGender === 'Male' ? males.length : females.length) + 1,
    };
    saveLearners([...section.learners, learner]);
    setManualName('');
  };

  const handleDelete = (learnerId: string) => {
    Alert.alert('Remove this learner?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => saveLearners(section.learners.filter((l) => l.id !== learnerId)),
      },
    ]);
  };

  const openReport = (learnerId: string) => router.push(`/section/${section.id}/learner/${learnerId}`);

  const renderList = (list: Learner[], color: string) => (
    <Card style={{ padding: 0 }}>
      {list.map((l, idx) => (
        <View
          key={l.id}
          style={[
            styles.learnerRow,
            idx < list.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
          ]}
        >
          <Text style={styles.learnerName}>
            <Text style={{ color: colors.textMuted }}>{l.order}. </Text>
            {l.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => openReport(l.id)}>
              <Text style={styles.linkBlue}>📊 Report</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(l.id)}>
              <Text style={styles.linkRed}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Card>
  );

  return (
    <View style={styles.screen}>
      <Header title={`Learners — ${section.name}`} onBack={() => router.back()} />
      <DuplicateBanner section={section} />

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Button label="📋 Bulk Upload Names" onPress={() => setShowBulk(true)} style={{ marginBottom: spacing.md, alignSelf: 'flex-start' }} />

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.quickAddTitle}>Quick Add</Text>
          <Field label="Name" value={manualName} onChangeText={setManualName} placeholder="LAST, FIRST M." />
          <Text style={styles.fieldLabelSpaced}>Gender</Text>
          <SegmentedControl
            options={[
              { label: 'Male', value: 'Male' as const },
              { label: 'Female', value: 'Female' as const },
            ]}
            value={manualGender}
            onChange={setManualGender}
          />
          <Button label="Add" onPress={handleAddManual} style={{ marginTop: spacing.sm }} />
        </Card>

        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.groupHeading, { color: colors.maroon }]}>♂ Male ({males.length})</Text>
          {males.length === 0 ? (
            <Text style={styles.emptyText}>No male learners yet.</Text>
          ) : (
            renderList(males, colors.maroon)
          )}
        </View>

        <View>
          <Text style={[styles.groupHeading, { color: colors.orange }]}>♀ Female ({females.length})</Text>
          {females.length === 0 ? (
            <Text style={styles.emptyText}>No female learners yet.</Text>
          ) : (
            renderList(females, colors.orange)
          )}
        </View>
      </ScrollView>

      <Modal visible={showBulk} onClose={() => setShowBulk(false)} maxWidth={480}>
        <ModalTitle>Bulk Upload Names</ModalTitle>
        <Text style={styles.bulkHelp}>
          Paste names from SF1 or Excel (one name per line). Format: LAST, FIRST M.
        </Text>
        <Text style={styles.fieldLabelSpaced}>These names are:</Text>
        <SegmentedControl
          options={[
            { label: 'Male', value: 'Male' as const },
            { label: 'Female', value: 'Female' as const },
          ]}
          value={bulkGender}
          onChange={setBulkGender}
        />
        <View style={{ marginTop: spacing.sm }}>
          <Field
            label="Names"
            value={bulkText}
            onChangeText={setBulkText}
            placeholder={'BANTANG, PAUL JAKE T.\nDADONG, JESTONY M.\n...'}
            multiline
            numberOfLines={8}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowBulk(false)} style={{ flex: 1 }} />
          <Button
            label={`Upload${bulkText.trim() ? ` (${bulkText.trim().split('\n').filter(Boolean).length})` : ''}`}
            onPress={handleBulkUpload}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  quickAddTitle: { fontWeight: '600', marginBottom: spacing.sm, fontSize: 14, color: colors.text },
  fieldLabelSpaced: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  groupHeading: { fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textMuted },
  learnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  learnerName: { fontSize: 14, color: colors.text, flexShrink: 1 },
  linkBlue: { color: '#2b4a8b', fontSize: 13 },
  linkRed: { color: colors.maroon, fontSize: 13 },
  bulkHelp: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
});
