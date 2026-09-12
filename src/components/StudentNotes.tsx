import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { Card } from './ui';
import { colors, radii, spacing } from '@/theme/theme';
import { getNotesForLearner, addNote, deleteNote, formatNoteDate } from '@/utils/notes';
import type { LearnerNote, Subject } from '@/types';

interface Props {
  sectionId: string;
  learnerId: string;
  subjects: Subject[];
}

export function StudentNotes({ sectionId, learnerId, subjects }: Props) {
  const safeSubjects = subjects ?? [];
  const [notes, setNotes] = useState<LearnerNote[]>([]);
  const category: LearnerNote['category'] = 'other';
  const [subjectId, setSubjectId] = useState<string>('');
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);

  const load = () => {
    try {
      setNotes(getNotesForLearner(sectionId, learnerId) ?? []);
    } catch {
      setNotes([]);
    }
  };

  useEffect(() => {
    load();
    setText('');
    setSubjectId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, learnerId]);

  const handleAdd = () => {
    addNote({ sectionId, learnerId, subjectId: subjectId || undefined, category, text: text || undefined });
    setText('');
    load();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete this note?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteNote(id); load(); } },
    ]);
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            Notes{' '}
            {notes.length > 0 && <Text style={styles.titleCount}>({notes.length})</Text>}
          </Text>
          <Text style={styles.subtitle}>
            A quick, dated record — e.g. "submitted assignment," "no PT materials."
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>

      {expanded && (
        <View style={{ marginTop: spacing.sm }}>
          {safeSubjects.length > 0 && (
            <View style={styles.subjectRow}>
              <Pressable
                onPress={() => setSubjectId('')}
                style={[styles.subjectChip, subjectId === '' && styles.subjectChipActive]}
              >
                <Text style={[styles.subjectChipText, subjectId === '' && styles.subjectChipTextActive]}>
                  General
                </Text>
              </Pressable>
              {safeSubjects.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSubjectId(s.id)}
                  style={[styles.subjectChip, subjectId === s.id && styles.subjectChipActive]}
                >
                  <Text style={[styles.subjectChipText, subjectId === s.id && styles.subjectChipTextActive]} numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder='Optional detail, e.g. "Quiz 2 - Photosynthesis"'
            placeholderTextColor={colors.textMuted}
          />

          <Pressable onPress={handleAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add Note</Text>
          </Pressable>

          {notes.length === 0 ? (
            <Text style={styles.emptyText}>No notes yet.</Text>
          ) : (
            <View style={{ gap: 8, marginTop: spacing.sm }}>
              {notes.map((n) => {
                const subj = safeSubjects.find((s) => s.id === n.subjectId);
                return (
                  <View key={n.id} style={styles.noteRow}>
                    <View style={{ flex: 1 }}>
                      {subj && <Text style={styles.noteMeta}>{subj.name}</Text>}
                      {!!n.text && <Text style={styles.noteText}>{n.text}</Text>}
                      <Text style={styles.noteDate}>{formatNoteDate(n.createdAt)}</Text>
                    </View>
                    <Pressable onPress={() => handleDelete(n.id)} hitSlop={8}>
                      <Text style={styles.deleteX}>✕</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '700', color: colors.text, fontSize: 14 },
  titleCount: { fontWeight: '700', color: colors.maroon, fontSize: 14 },
  subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 18, color: colors.textMuted, marginLeft: 8 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  subjectChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  subjectChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  subjectChipText: { fontSize: 11, color: colors.text },
  subjectChipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  addBtn: {
    backgroundColor: colors.orange,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { fontSize: 12, color: colors.textMuted },
  noteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteMeta: { fontSize: 12 },
  noteText: { fontSize: 13, color: colors.text, marginTop: 2 },
  noteDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  deleteX: { color: colors.textMuted, fontSize: 14, padding: 4 },
});
