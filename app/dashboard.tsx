import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Modal, ModalTitle, Field, SegmentedControl } from '@/components/ui';
import { colors, radii, spacing, tints } from '@/theme/theme';
import { getAllSections, putSection, deleteSection } from '@/db/repositories/sections';
import { duplicateSection } from '@/db/duplicate';
import { uuid } from '@/utils/id';
import type { Section } from '@/types';
import {
  createBackup,
  daysSince,
  getLastBackupAt,
  getSnoozedUntil,
  snoozeBackupReminder,
} from '@/db/backup';

const BACKUP_REMINDER_DAYS = 7;

// The PWA writes these two translucent-maroon values inline on the Dashboard's
// backup reminder card; no theme tint expresses a 6% / 30% maroon mix.
const REMINDER_BG = 'rgba(139, 38, 38, 0.06)'; // PWA pages/Dashboard.tsx:200
const REMINDER_BORDER = 'rgba(139, 38, 38, 0.3)'; // PWA pages/Dashboard.tsx:201

// The PWA's per-section "⧉ Duplicate" chip uses a blue that appears nowhere else
// in the app (pages/Dashboard.tsx:415-417) — no token, so it stays local.

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState<'11' | '12'>('11');
  const [duplicating, setDuplicating] = useState<Section | null>(null);
  const [dupName, setDupName] = useState('');
  const [lastBackupAt, setLastBackupAtState] = useState<number | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);

  const load = useCallback(() => {
    setAllSections(getAllSections());
    setLastBackupAtState(getLastBackupAt());
    setSnoozedUntil(getSnoozedUntil());
  }, []);

  useFocusEffect(load);

  const sections = allSections.filter((s) => !s.isDuplicate);
  const duplicateCount = allSections.filter((s) => s.isDuplicate).length;

  const backupDays = daysSince(lastBackupAt);
  const isSnoozed = snoozedUntil !== null && Date.now() < snoozedUntil;
  const needsBackupReminder =
    sections.length > 0 &&
    !isSnoozed &&
    (lastBackupAt === null || (backupDays !== null && backupDays >= BACKUP_REMINDER_DAYS));

  const handleSnooze = () => {
    snoozeBackupReminder(3);
    setSnoozedUntil(getSnoozedUntil());
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      await createBackup();
      setLastBackupAtState(getLastBackupAt());
      setSnoozedUntil(null);
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'Something went wrong.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const section: Section = {
      id: uuid(),
      name: newName.trim().toUpperCase(),
      gradeLevel: Number(newGrade) as 11 | 12,
      learners: [],
      subjects: [],
    };
    putSection(section);
    setNewName('');
    setShowAdd(false);
    load();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete this section?', 'This deletes it and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSection(id);
          load();
        },
      },
    ]);
  };

  const handleDuplicateConfirm = () => {
    if (!duplicating || !dupName.trim()) return;
    const copy = duplicateSection(duplicating, dupName.trim().toUpperCase());
    setDuplicating(null);
    setDupName('');
    load();
    router.push(`/section/${copy.id}`);
  };

  return (
    <View style={styles.screen}>
      {/* PWA `.header`: maroon bar, title on the left, action pills on the right. */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>My Sections</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerBtn} onPress={() => router.push('/duplicates')}>
            <Text style={styles.headerBtnText}>
              ⧉ Duplicates{duplicateCount > 0 ? ` (${duplicateCount})` : ''}
            </Text>
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => router.push('/school-settings')}>
            <Text style={styles.headerBtnText}>🏫 School Info</Text>
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.headerBtnText}>⚙ Backup / Logout</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {needsBackupReminder && (
          <Card style={styles.reminderCard}>
            <View style={styles.reminderRow}>
              <View style={styles.reminderText}>
                <Text style={styles.reminderTitle}>
                  ⚠️ {lastBackupAt === null ? "You haven't backed up yet" : `No backup in ${backupDays} days`}
                </Text>
                <Text style={styles.reminderBody}>
                  Everything is stored only on this device. Back up so a lost or reset device
                  doesn't mean lost records.
                </Text>
              </View>
              <View style={styles.reminderActions}>
                <Button label="Remind me in 3 days" variant="secondary" size="sm" onPress={handleSnooze} />
                <Button
                  label={backingUp ? 'Backing up…' : 'Backup Now'}
                  variant="accent"
                  size="sm"
                  onPress={handleBackupNow}
                  loading={backingUp}
                />
              </View>
            </View>
          </Card>
        )}

        <View style={styles.toolbar}>
          <Text style={styles.count}>
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.toolbarActions}>
            <Button
              label="📄 Import Excel"
              variant="secondary"
              onPress={() => router.push('/import-excel')}
              style={styles.importBtn}
            />
            <Button label="+ Add Section" variant="accent" onPress={() => setShowAdd(true)} />
          </View>
        </View>

        {sections.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No sections yet.</Text>
            <Text style={styles.emptyBody}>
              Tap "Add Section" to create your first class (e.g. VALOR).
            </Text>
          </Card>
        )}

        <View style={styles.sectionList}>
          {sections.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/section/${s.id}`)}>
              <Card>
                <View style={styles.sectionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionName}>{s.name}</Text>
                    <Text style={styles.sectionMeta}>
                      Grade {s.gradeLevel} • {s.learners.length} learners • {s.subjects.length}{' '}
                      subject{s.subjects.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.sectionActions}>
                    <Pressable
                      style={styles.smallBtnBlue}
                      onPress={() => {
                        setDuplicating(s);
                        setDupName(`${s.name} (COPY)`);
                      }}
                    >
                      <Text style={styles.smallBtnBlueText}>⧉ Duplicate</Text>
                    </Pressable>
                    <Pressable style={styles.smallBtnRed} onPress={() => handleDelete(s.id)}>
                      <Text style={styles.smallBtnRedText}>Delete</Text>
                    </Pressable>
                    <Text style={styles.sectionChevron}>›</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showAdd} onClose={() => setShowAdd(false)}>
        <ModalTitle>Add Section</ModalTitle>
        <Field label="Section Name" value={newName} onChangeText={setNewName} placeholder="e.g. VALOR" />
        <Text style={styles.fieldLabelSpaced}>Grade Level</Text>
        <SegmentedControl
          options={[
            { label: 'Grade 11', value: '11' },
            { label: 'Grade 12', value: '12' },
          ]}
          value={newGrade}
          onChange={setNewGrade}
        />
        <View style={styles.modalActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowAdd(false)} style={{ flex: 1 }} />
          <Button label="Save" onPress={handleAdd} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal visible={!!duplicating} onClose={() => setDuplicating(null)}>
        <ModalTitle>⧉ Duplicate Section</ModalTitle>
        {duplicating && (
          <Text style={styles.dupHelp}>
            Creates an independent, editable copy of "{duplicating.name}" — all learners, scores,
            and attendance included. Changes to the copy never touch the original.
          </Text>
        )}
        <Field label="New Copy Name" value={dupName} onChangeText={setDupName} autoFocus />
        <View style={styles.dupActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setDuplicating(null)} style={{ flex: 1 }} />
          <Button label="Duplicate" onPress={handleDuplicateConfirm} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // PWA `.header` (styles/theme.css): maroon bar, 14px×16px padding, title 18/700.
  header: {
    backgroundColor: colors.maroon,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  // PWA header pill (pages/Dashboard.tsx:149-190): rgba(255,255,255,0.2), radius 8, 13px, no weight set.
  headerBtn: {
    backgroundColor: tints.onPrimarySoft,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  headerBtnText: { color: '#FFFFFF', fontSize: 13 },

  // PWA backup-reminder card (pages/Dashboard.tsx:196-235): text left, buttons right, both wrap.
  reminderCard: {
    marginBottom: spacing.md,
    backgroundColor: REMINDER_BG,
    borderColor: REMINDER_BORDER,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  reminderText: { flexShrink: 1 },
  reminderTitle: { fontWeight: '700', color: colors.maroon, fontSize: 14 },
  reminderBody: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  reminderActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },

  // PWA toolbar (pages/Dashboard.tsx:238-257): count left, actions right.
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  count: { fontSize: 14, color: colors.textMuted },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  // PWA overrides the Import Excel button's padding to 10px×14px (pages/Dashboard.tsx:250).
  importBtn: { paddingVertical: 10, paddingHorizontal: 14 },

  // PWA empty state (pages/Dashboard.tsx:366-376): centered text, 32px padding.
  emptyCard: { alignItems: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.textMuted, fontSize: 16, marginBottom: 12, textAlign: 'center' },
  emptyBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  // PWA section list (pages/Dashboard.tsx:378-447): 12px gap between cards.
  sectionList: { gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionName: { fontWeight: '700', fontSize: 17, color: colors.maroon },
  sectionMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // PWA chips (pages/Dashboard.tsx:414-442): radius 6 (not the 8px `--radius-sm`), 12px, no weight set.
  smallBtnBlue: {
    backgroundColor: colors.infoBg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  smallBtnBlueText: { color: colors.info, fontSize: 12 },
  smallBtnRed: {
    backgroundColor: colors.errorBg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  smallBtnRedText: { color: colors.maroon, fontSize: 12 },
  // PWA row chevron (pages/Dashboard.tsx:443): accent-orange, 20px.
  sectionChevron: { color: colors.orange, fontSize: 20 },

  fieldLabelSpaced: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  // PWA Add Section modal: the grade field has marginBottom 20 before the buttons (pages/Dashboard.tsx:481).
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  // PWA Duplicate modal: the field div is marginBottom 20 (pages/Dashboard.tsx:535); `Field` already
  // contributes 12px, so add only the remaining 8px.
  dupActions: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  dupHelp: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
});
