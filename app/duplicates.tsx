import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Header } from '@/components/Header';
import { Card, Button, Modal, ModalTitle, Field } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
import { getAllSections } from '@/db/repositories/sections';
import { deleteDuplicateSection, renameDuplicateSection } from '@/db/duplicate';
import type { Section } from '@/types';

export default function Duplicates() {
  const [duplicates, setDuplicates] = useState<Section[]>([]);
  const [renaming, setRenaming] = useState<Section | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(() => {
    setDuplicates(getAllSections().filter((s) => s.isDuplicate));
  }, []);

  useFocusEffect(load);

  const handleDelete = (s: Section) => {
    Alert.alert(
      `Delete duplicate "${s.name}"?`,
      'This removes its scores and attendance too. The original is unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDuplicateSection(s);
            load();
          },
        },
      ]
    );
  };

  const handleRenameConfirm = () => {
    if (!renaming || !renameValue.trim()) return;
    renameDuplicateSection(renaming, renameValue.trim());
    setRenaming(null);
    load();
  };

  return (
    <View style={styles.screen}>
      <Header
        title="⧉ Duplicated Records"
        subtitle="Independent copies — separate from your main sections"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {duplicates.length === 0 ? (
          <Card style={{ alignItems: 'center', padding: spacing.xl }}>
            <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
              No duplicated records yet.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
              From a section on your dashboard, tap "⧉ Duplicate" to make an editable copy —
              useful for what-if grade changes, drafts, or backups without touching the original.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {duplicates.map((s) => (
              <Pressable key={s.id} onPress={() => router.push(`/section/${s.id}`)}>
                <Card>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{s.name}</Text>
                      <Text style={styles.meta}>
                        Copy of "{s.duplicatedFromName ?? 'a previous section'}"
                        {s.duplicatedAt ? ` · ${new Date(s.duplicatedAt).toLocaleDateString()}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.smallBtn}
                      onPress={() => {
                        setRenaming(s);
                        setRenameValue(s.name);
                      }}
                    >
                      <Text style={styles.smallBtnText}>Rename</Text>
                    </Pressable>
                    <Pressable style={styles.smallBtnRed} onPress={() => handleDelete(s)}>
                      <Text style={styles.smallBtnRedText}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!renaming} onClose={() => setRenaming(null)}>
        <ModalTitle>Rename Duplicate</ModalTitle>
        <Field label="Name" value={renameValue} onChangeText={setRenameValue} autoFocus />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
          <Button label="Cancel" variant="secondary" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
          <Button label="Save" onPress={handleRenameConfirm} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontWeight: '700', fontSize: 16, color: colors.maroon },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  smallBtn: {
    backgroundColor: colors.cream,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  smallBtnText: { color: colors.maroon, fontSize: 12, fontWeight: '600' },
  smallBtnRed: {
    backgroundColor: '#fce8e8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  smallBtnRedText: { color: colors.maroon, fontSize: 12, fontWeight: '600' },
});
