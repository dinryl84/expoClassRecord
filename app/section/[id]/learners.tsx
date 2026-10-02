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
import { deleteLearnerPermanently, getLearnerRecordCounts } from '@/db/learnerDelete';
import { createBackup, getLastBackupAt, formatBackupDate } from '@/db/backup';
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

  const performDelete = (learner: Learner) => {
    try {
      deleteLearnerPermanently(section, learner.id);
      load();
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? 'Something went wrong. The learner was not deleted.');
    }
  };

  const confirmAfterBackup = (learner: Learner) => {
    Alert.alert(
      'Backup created',
      `Make sure you saved the backup file somewhere safe (for example Google Drive).\n\nPermanently delete ${learner.name} now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Permanently', style: 'destructive', onPress: () => performDelete(learner) },
      ]
    );
  };

  const backupThenConfirm = async (learner: Learner) => {
    try {
      await createBackup();
      confirmAfterBackup(learner);
    } catch (e: any) {
      Alert.alert('Backup failed', `${e?.message ?? 'Something went wrong.'}\n\n${learner.name} was NOT deleted.`);
    }
  };

  const handleDelete = (learner: Learner) => {
    const counts = getLearnerRecordCounts(section.id, learner.id);
    const lastBackup = formatBackupDate(getLastBackupAt());
    Alert.alert(
      `Permanently delete ${learner.name}?`,
      `This will erase this learner's scores in every subject, ${counts.attendance} attendance record${
        counts.attendance !== 1 ? 's' : ''
      } and ${counts.notes} note${counts.notes !== 1 ? 's' : ''}. This cannot be undone.\n\nLast backup: ${lastBackup}\n\nWe recommend backing up first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Back Up First', onPress: () => backupThenConfirm(learner) },
        { text: 'Delete Permanently', style: 'destructive', onPress: () => performDelete(learner) },
      ]
    );
  };

  const openReport = (learnerId: string) => router.push(`/section/${section.id}/learner/${learnerId}`);

  const renderList = (list: Learner[], color: string) => (
    <Card style={{ padding: 0 }}>
      {list.map((l, idx) => (
        <View
          key={l.id}
          style={[
            styles.learnerRow,
            idx < list.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider },
          ]}
        >
          <Text style={styles.learnerName}>
            <Text style={{ color: colors.textMuted }}>{l.order}. </Text>
            {l.name}
          </Text>
          {/* Stacked (Report above Remove) so the name keeps more width, the two
              links are bigger to tap, and Remove is not right next to Report. */}
          <View style={styles.rowActions}>
            <Pressable onPress={() => openReport(l.id)} style={styles.rowActionBtn} hitSlop={6}>
              <Text style={styles.linkBlue}>📊 Report</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(l)} style={styles.rowActionBtn} hitSlop={6}>
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
        {/* PWA renders this as `.btn btn-accent` (orange), not the default maroon. */}
        <Button
          variant="accent"
          label="📋 Bulk Upload Names"
          onPress={() => setShowBulk(true)}
          style={{ marginBottom: spacing.md, alignSelf: 'flex-start' }}
        />

        {/* PWA Quick Add `.card` carries marginBottom:20. */}
        <Card style={{ marginBottom: 20 }}>
          <Text style={styles.quickAddTitle}>Quick Add</Text>
          {/* PWA quick add has no labels on its name input or gender select. */}
          {/* The PWA labels neither of these; keep an accessibility name since
              the visible label is gone. */}
          <Field
            value={manualName}
            onChangeText={setManualName}
            placeholder="LAST, FIRST M."
            accessibilityLabel="Learner name"
          />
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

      {/* PWA "Bulk Upload Names" is a bottom sheet (rgba(0,0,0,0.45) backdrop,
          flex-end, 16px top radius, maxWidth 480) — the shared Modal's `sheet`. */}
      <Modal visible={showBulk} onClose={() => setShowBulk(false)} maxWidth={480} variant="sheet">
        {/* PWA bulk-upload `<h2>` carries marginBottom:8. */}
        <ModalTitle style={{ marginBottom: 8 }}>Bulk Upload Names</ModalTitle>
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
            value={bulkText}
            onChangeText={setBulkText}
            placeholder={'BANTANG, PAUL JAKE T.\nDADONG, JESTONY M.\n...'}
            accessibilityLabel="Names to upload"
            multiline
            numberOfLines={10}
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
  // PWA "Quick Add" title: fontSize 14 / 600, marginBottom 10.
  quickAddTitle: { fontWeight: '600', marginBottom: 10, fontSize: 14, color: colors.text },
  fieldLabelSpaced: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  // The PWA group heading is a bare <h3> with no inline size, so it renders at
  // the browser default 1.17em of the 16px body = ~18.7px, weight 700.
  groupHeading: { fontSize: 18.7, fontWeight: '700', marginBottom: spacing.sm },
  emptyText: { fontSize: 13, color: colors.textMuted },
  learnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  // The PWA row text sets no font-size, inheriting the body's 16px.
  learnerName: { fontSize: 16, color: colors.text, flex: 1, paddingRight: 12 },
  rowActions: { alignItems: 'flex-end', gap: 2 },
  rowActionBtn: { paddingVertical: 5, paddingLeft: 8 },
  linkBlue: { color: colors.info, fontSize: 14 },
  linkRed: { color: colors.maroon, fontSize: 14 },
  // PWA help paragraph: fontSize 13, marginBottom 14.
  bulkHelp: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
});
