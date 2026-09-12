import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Header } from '@/components/Header';
import { Card, Button, Modal, ModalTitle, Field } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { getAllSections } from '@/db/repositories/sections';
import { deleteDuplicateSection, renameDuplicateSection } from '@/db/duplicate';
import type { Section } from '@/types';

// The PWA DuplicateRecords.tsx draws its Rename chip inline; the light-blue
// pair it uses is now the colors.infoBg / colors.info token pair.
// The PWA's inline Rename/Delete chips use borderRadius: 6 — smaller than the
// --radius-sm (8px) token, so there is nothing to reuse here.
const CHIP_RADIUS = 6;

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
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyLead}>No duplicated records yet.</Text>
            <Text style={styles.emptyHint}>
              From a section on your dashboard, tap "⧉ Duplicate" to make an editable copy —
              useful for what-if grade changes, drafts, or backups without touching the original.
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {duplicates.map((s) => (
              <Pressable key={s.id} onPress={() => router.push(`/section/${s.id}`)}>
                <Card>
                  <View style={styles.cardRow}>
                    <View style={styles.info}>
                      <Text style={styles.name}>{s.name}</Text>
                      <Text style={styles.meta}>
                        Copy of "{s.duplicatedFromName ?? 'a previous section'}"
                        {s.duplicatedAt ? ` · ${new Date(s.duplicatedAt).toLocaleDateString()}` : ''}
                      </Text>
                    </View>
                    <View style={styles.actions}>
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
                      {/* PWA chevron affordance after the chips: colour var(--color-accent), fontSize 20 */}
                      <Text style={styles.chevron}>›</Text>
                    </View>
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
  // PWA empty state: a centred .card (textAlign centre, padding 32) in muted text.
  // Its lead line is a default-size <p> (16px), the hint is the 13px one.
  emptyCard: { alignItems: 'center', padding: spacing.xl },
  emptyLead: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.sm },
  emptyHint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  // PWA list container: column, gap 12
  list: { gap: 12 },
  // PWA row: .card is space-between / centre; left block flex:1 (min-width:0), chips flex-shrink 0
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  name: { fontWeight: '700', fontSize: 16, color: colors.maroon },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // PWA Rename chip: bg '#eef2fb', text '#2b4a8b', padding 6/10, radius 6, 12px (no bold)
  smallBtn: {
    backgroundColor: colors.infoBg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: CHIP_RADIUS,
  },
  smallBtnText: { color: colors.info, fontSize: 12 },
  // PWA Delete chip: bg errorBg '#fce8e8', text var(--color-primary), padding 6/10, radius 6, 12px
  smallBtnRed: {
    backgroundColor: colors.errorBg,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: CHIP_RADIUS,
  },
  smallBtnRedText: { color: colors.maroon, fontSize: 12 },
  chevron: { color: colors.orange, fontSize: 20 },
});
