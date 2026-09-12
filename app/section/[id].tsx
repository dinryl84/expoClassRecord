import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/Header';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { Button, Card, Modal, ModalTitle, Field, SegmentedControl, OptionList } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';
import { getSectionById, putSection } from '@/db/repositories/sections';
import { uuid } from '@/utils/id';
import type { Section, Subject, SubjectType } from '@/types';

const SUBJECT_TYPES: { label: string; value: SubjectType }[] = [
  { label: 'Core Subject (All Tracks)', value: 'Core Subject (All Tracks)' },
  { label: 'Academic Elective (Other)', value: 'Academic Elective (All Other Electives)' },
  {
    label: 'Academic Elective (Field / Sports / Arts)',
    value: 'Academic Elective (Field Experience / Exposure, and Sports and Arts)',
  },
  { label: 'TechPro Elective (Other)', value: 'TechPro Elective (All Other Electives)' },
  { label: 'TechPro Elective (Work Immersion)', value: 'TechPro Elective (Work Immersion)' },
];

export default function SectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [section, setSection] = useState<Section | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showEditSection, setShowEditSection] = useState(false);
  const [renamingSubject, setRenamingSubject] = useState<Subject | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState<'11' | '12'>('11');
  const [subjName, setSubjName] = useState('General Mathematics');
  const [subjType, setSubjType] = useState<SubjectType>('Core Subject (All Tracks)');

  const load = useCallback(() => {
    if (id) setSection(getSectionById(id));
  }, [id]);

  useFocusEffect(load);

  if (!section) {
    return (
      <View style={styles.screen}>
        <Header title="Section" onBack={() => router.back()} />
      </View>
    );
  }

  const handleAddSubject = () => {
    if (!subjName.trim()) return;
    const subject: Subject = { id: uuid(), name: subjName.trim(), subjectType: subjType, sectionId: section.id };
    putSection({ ...section, subjects: [...section.subjects, subject] });
    setShowAddSubject(false);
    load();
  };

  const handleSaveSection = () => {
    const name = editName.trim().toUpperCase();
    if (!name) return;
    putSection({ ...section, name, gradeLevel: Number(editGrade) as 11 | 12 });
    setShowEditSection(false);
    load();
  };

  const handleRenameSubject = () => {
    if (!renamingSubject || !renameValue.trim()) return;
    const subjects = section.subjects.map((s) =>
      s.id === renamingSubject.id ? { ...s, name: renameValue.trim() } : s
    );
    putSection({ ...section, subjects });
    setRenamingSubject(null);
    load();
  };

  return (
    <View style={styles.screen}>
      <Header
        title={`${section.gradeLevel} - ${section.name}`}
        onBack={() => router.back()}
        rightLabel="Edit"
        onRightPress={() => {
          setEditName(section.name);
          setEditGrade(String(section.gradeLevel) as '11' | '12');
          setShowEditSection(true);
        }}
      />
      <DuplicateBanner section={section} />

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/section/${section.id}/learners`)}>
            <Text style={styles.actionBtnText}>👥 Learners ({section.learners.length})</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push(`/section/${section.id}/attendance`)}
          >
            <Text style={styles.actionBtnText}>📋 Attendance</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, section.learners.length === 0 && styles.actionBtnDisabled]}
            disabled={section.learners.length === 0}
            onPress={() => router.push(`/section/${section.id}/learners`)}
          >
            <Text style={styles.actionBtnText}>🎓 Student Reports</Text>
          </Pressable>
          <Button label="+ Add Subject" onPress={() => setShowAddSubject(true)} />
        </View>

        <Text style={styles.sectionHeading}>Subjects</Text>

        {section.subjects.length === 0 ? (
          <Card style={{ alignItems: 'center', padding: spacing.lg }}>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
              No subjects yet. Add General Mathematics or any subject you teach.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {section.subjects.map((subj) => (
              <Pressable
                key={subj.id}
                onPress={() => router.push(`/section/${section.id}/subject/${subj.id}`)}
              >
                <Card>
                  <View style={styles.subjectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subjectName}>{subj.name}</Text>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: subj.subjectType.includes('Core') ? '#E9F0E3' : '#FBEFE9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: subj.subjectType.includes('Core') ? colors.green : colors.orange },
                          ]}
                        >
                          {subj.subjectType.includes('Core') ? 'Core Subject' : 'Elective'}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.renameBtn}
                      onPress={() => {
                        setRenamingSubject(subj);
                        setRenameValue(subj.name);
                      }}
                    >
                      <Text style={styles.renameBtnText}>Rename</Text>
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showEditSection} onClose={() => setShowEditSection(false)}>
        <ModalTitle>Edit Section</ModalTitle>
        <Field
          label="Section Name"
          value={editName}
          onChangeText={setEditName}
          placeholder="e.g. VALOR"
          helperText="Fix spelling here if the imported name was wrong."
        />
        <Text style={styles.fieldLabelSpaced}>Grade Level</Text>
        <SegmentedControl
          options={[
            { label: 'Grade 11', value: '11' },
            { label: 'Grade 12', value: '12' },
          ]}
          value={editGrade}
          onChange={setEditGrade}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowEditSection(false)} style={{ flex: 1 }} />
          <Button label="Save" onPress={handleSaveSection} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal visible={showAddSubject} onClose={() => setShowAddSubject(false)}>
        <ModalTitle>Add Subject</ModalTitle>
        <Field label="Subject Name" value={subjName} onChangeText={setSubjName} />
        <Text style={styles.fieldLabelSpaced}>Subject Type</Text>
        <OptionList options={SUBJECT_TYPES} value={subjType} onChange={setSubjType} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowAddSubject(false)} style={{ flex: 1 }} />
          <Button label="Save" onPress={handleAddSubject} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal visible={!!renamingSubject} onClose={() => setRenamingSubject(null)}>
        <ModalTitle>Rename Subject</ModalTitle>
        <Field label="Subject Name" value={renameValue} onChangeText={setRenameValue} autoFocus />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
          <Button label="Cancel" variant="secondary" onPress={() => setRenamingSubject(null)} style={{ flex: 1 }} />
          <Button label="Save" onPress={handleRenameSubject} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  actionBtn: {
    borderWidth: 1.5,
    borderColor: colors.maroon,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: colors.maroon, fontWeight: '600', fontSize: 13 },
  sectionHeading: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectName: { fontWeight: '700', color: colors.maroon, fontSize: 15 },
  badge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  renameBtn: {
    backgroundColor: colors.cream,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  renameBtnText: { color: colors.maroon, fontSize: 12, fontWeight: '600' },
  fieldLabelSpaced: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
});
