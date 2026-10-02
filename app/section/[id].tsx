import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Header } from '@/components/Header';
import { DuplicateBanner } from '@/components/DuplicateBanner';
import { Button, Card, Modal, ModalTitle, Field, SegmentedControl, OptionList } from '@/components/ui';
import { colors, spacing, tints } from '@/theme/theme';
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
          {/* PWA renders these as `.btn btn-outline` (2px maroon border, 12px 20px
              padding, 15/600) — the shared Button reproduces that `.btn`. */}
          <Button
            variant="outline"
            label={`👥 Learners (${section.learners.length})`}
            onPress={() => router.push(`/section/${section.id}/learners`)}
          />
          <Button
            variant="outline"
            label="📋 Attendance"
            onPress={() => router.push(`/section/${section.id}/attendance`)}
          />
          <Button
            variant="outline"
            label="🗓 Absences"
            disabled={section.learners.length === 0}
            onPress={() => router.push(`/section/${section.id}/absences`)}
          />
          <Button
            variant="outline"
            label="🎓 Student Reports"
            disabled={section.learners.length === 0}
            onPress={() => router.push(`/section/${section.id}/learners`)}
          />
          {/* PWA's "+ Add Subject" is `.btn btn-accent` (orange), not the default maroon. */}
          <Button variant="accent" label="+ Add Subject" onPress={() => setShowAddSubject(true)} />
        </View>

        <Text style={styles.sectionHeading}>Subjects</Text>

        {section.subjects.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>
              No subjects yet. Add General Mathematics or any subject you teach.
            </Text>
          </Card>
        ) : (
          <View style={styles.subjectList}>
            {section.subjects.map((subj) => (
              <Pressable
                key={subj.id}
                onPress={() => router.push(`/section/${section.id}/subject/${subj.id}`)}
              >
                <Card>
                  <View style={styles.subjectRow}>
                    <View style={styles.subjectLeft}>
                      <Text style={styles.subjectName}>{subj.name}</Text>
                      {/* PWA badge classes: `.badge-core` = color-mix(primary 15%) bg +
                          primary text; `.badge-elective` = color-mix(accent 15%) bg +
                          accent text (see theme.css). The RN tints table ports those. */}
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: subj.subjectType.includes('Core')
                              ? tints.primary15
                              : tints.accent15,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: subj.subjectType.includes('Core') ? colors.maroon : colors.orange },
                          ]}
                        >
                          {subj.subjectType.includes('Core') ? 'Core Subject' : 'Elective'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.subjectRight}>
                      <Pressable
                        style={styles.renameBtn}
                        onPress={() => {
                          setRenamingSubject(subj);
                          setRenameValue(subj.name);
                        }}
                      >
                        <Text style={styles.renameBtnText}>Rename</Text>
                      </Pressable>
                      <Text style={styles.chevron}>›</Text>
                    </View>
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
        {/* PWA's Grade Level block carries marginBottom:20 before the action row. */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <Button label="Cancel" variant="secondary" onPress={() => setShowEditSection(false)} style={{ flex: 1 }} />
          <Button label="Save" onPress={handleSaveSection} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal visible={showAddSubject} onClose={() => setShowAddSubject(false)} maxWidth={380}>
        <ModalTitle>Add Subject</ModalTitle>
        <Field label="Subject Name" value={subjName} onChangeText={setSubjName} />
        <Text style={styles.fieldLabelSpaced}>Subject Type</Text>
        <OptionList options={SUBJECT_TYPES} value={subjType} onChange={setSubjType} />
        {/* PWA's Subject Type block carries marginBottom:20 before the action row. */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
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
  // PWA actions row: `display:flex; gap:10; marginBottom:20; flexWrap:wrap`.
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  // PWA `<h2 style={{ fontSize:14, color:var(--color-text-muted), marginBottom:10,
  //   textTransform:'uppercase', letterSpacing:0.5 }}>` — an <h2> is 700 by default.
  sectionHeading: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  // PWA empty state is a `.card` whose text is `textAlign:center; color:text-muted`.
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  // PWA subjects list: `display:flex; flexDirection:column; gap:10`.
  subjectList: { gap: 10 },
  // PWA subject card inner row: `justify-content:space-between; align-items:center`.
  subjectRow: { flexDirection: 'row', alignItems: 'center' },
  subjectLeft: { flex: 1 },
  // PWA name: `fontWeight:700; color:var(--color-primary)` — inherits body's 16px.
  subjectName: { fontWeight: '700', color: colors.maroon, fontSize: 16 },
  // PWA `.badge`: padding 4px 10px; radius 999px; font 12/600.
  badge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  // PWA subject card right cluster: `display:flex; gap:8; align-items:center`.
  subjectRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  // PWA rename `<button>`: bg cream, color primary, padding 6px 8px; radius 6; font 11.
  renameBtn: {
    backgroundColor: colors.cream,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  renameBtnText: { color: colors.maroon, fontSize: 11 },
  // PWA trailing chevron `<span style={{ color:var(--color-accent), fontSize:22 }}>›</span>`.
  chevron: { color: colors.orange, fontSize: 22 },
  // PWA "Grade Level"/"Subject Type" labels: fontSize 13; fontWeight 600.
  fieldLabelSpaced: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
});
