import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Modal, ModalTitle, Field, SegmentedControl } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>My Sections</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerBtn} onPress={() => router.push('/import-excel')}>
            <Text style={styles.headerBtnText}>📄 Import Excel</Text>
          </Pressable>
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
            <Text style={styles.reminderTitle}>
              ⚠️ {lastBackupAt === null ? "You haven't backed up yet" : `No backup in ${backupDays} days`}
            </Text>
            <Text style={styles.reminderBody}>
              Everything is stored only on this device. Back up so a lost or reset device doesn't
              mean lost records.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
              <Button label="Remind me in 3 days" variant="secondary" onPress={handleSnooze} style={{ flex: 1 }} />
              <Button
                label={backingUp ? 'Backing up…' : 'Backup Now'}
                onPress={handleBackupNow}
                loading={backingUp}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}

        <View style={styles.toolbar}>
          <Text style={styles.count}>
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </Text>
          <Button label="+ Add Section" onPress={() => setShowAdd(true)} />
        </View>

        {sections.length === 0 && (
          <Card style={{ alignItems: 'center', padding: spacing.xl }}>
            <Text style={{ color: colors.textMuted, marginBottom: 8 }}>No sections yet.</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Tap "Add Section" to create your first class (e.g. VALOR).
            </Text>
          </Card>
        )}

        <View style={{ gap: spacing.sm }}>
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
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
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
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
          <Button label="Cancel" variant="secondary" onPress={() => setDuplicating(null)} style={{ flex: 1 }} />
          <Button label="Duplicate" onPress={handleDuplicateConfirm} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.maroon, paddingHorizontal: spacing.md, paddingBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  headerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reminderCard: {
    marginBottom: spacing.md,
    backgroundColor: 'rgba(139,38,38,0.06)',
    borderColor: 'rgba(139,38,38,0.3)',
  },
  reminderTitle: { fontWeight: '700', color: colors.maroon, fontSize: 14 },
  reminderBody: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  count: { fontSize: 14, color: colors.textMuted },
  sectionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  sectionName: { fontWeight: '700', fontSize: 17, color: colors.maroon },
  sectionMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  smallBtnBlue: {
    backgroundColor: '#eef2fb',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  smallBtnBlueText: { color: '#2b4a8b', fontSize: 12, fontWeight: '600' },
  smallBtnRed: {
    backgroundColor: '#fce8e8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  smallBtnRedText: { color: colors.maroon, fontSize: 12, fontWeight: '600' },
  fieldLabelSpaced: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  dupHelp: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
});
