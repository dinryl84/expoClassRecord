import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Header } from '@/components/Header';
import { Button, Card } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { pickAndImportClassRecord, type FullImportResult } from '@/utils/importExcel';
import { getTemplate, deleteTemplate } from '@/db/repositories/templates';

const TEMPLATE_ID = 'ecr-template';

export default function ImportExcel() {
  const [importBusy, setImportBusy] = useState(false);
  const [result, setResult] = useState<FullImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(null);

  const refreshTemplate = useCallback(() => {
    const t = getTemplate(TEMPLATE_ID);
    setCustomTemplateName(t?.name ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshTemplate();
    }, [refreshTemplate])
  );

  const handleImportClassRecord = async () => {
    setImportBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await pickAndImportClassRecord();
      if (r) setResult(r);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong reading that file.');
    } finally {
      setImportBusy(false);
    }
  };

  const handleClearStoredTemplate = () => {
    Alert.alert(
      'Clear stored template?',
      'Removes any previously saved custom template file from the app. Exports already use the built-in blank template, so this is optional cleanup only. Sections and scores are not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            deleteTemplate(TEMPLATE_ID);
            setCustomTemplateName(null);
            Alert.alert('Done', 'Stored custom template cleared.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <Header title="Import Excel" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card>
          <Text style={styles.title}>1. Import Class Record</Text>
          <Text style={styles.body}>
            Use this when you already have a filled DepEd SHS Electronic Class Record and want its
            section, learners, and scores inside the app.
          </Text>
          <Text style={styles.body}>
            This only loads data into the app. Exports always start from a blank template, so
            importing one section cannot change what appears when you export another.
          </Text>

          <Button
            label={importBusy ? 'Importing…' : 'Choose Class Record…'}
            onPress={handleImportClassRecord}
            loading={importBusy}
            style={{ marginTop: spacing.md }}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>✅ Import complete</Text>
              <Text style={styles.resultText}>{result.message}</Text>
              <Button
                label="View Section →"
                variant="secondary"
                onPress={() => router.replace(`/section/${result.sectionId}`)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.title}>2. Export behavior</Text>
          <Text style={styles.body}>
            Every export uses the app’s built-in blank official ECR template, then fills in only
            the section and subject you are exporting. A previously imported filled file can no
            longer leak names or grades into another section’s export.
          </Text>
          {customTemplateName ? (
            <>
              <Text style={styles.body}>
                An old custom file is still stored on this device ({customTemplateName}). It is not
                used for export anymore. You can clear it below.
              </Text>
              <Button
                label="Clear Stored Template"
                variant="secondary"
                onPress={handleClearStoredTemplate}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 15, fontWeight: '700', color: colors.maroon, marginBottom: spacing.sm },
  body: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  resultBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#E9F0E3',
  },
  resultTitle: { fontWeight: '700', color: colors.green, marginBottom: 4 },
  resultText: { fontSize: 13, color: colors.text },
});
