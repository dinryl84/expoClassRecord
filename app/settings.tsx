import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { createBackup, pickAndRestoreBackup, getLastBackupAt, formatBackupDate } from '@/db/backup';
import { setCurrentUser, getCurrentUser } from '@/db/repositories/settings';

export default function Settings() {
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [lastBackup, setLastBackup] = useState(getLastBackupAt());
  const username = getCurrentUser();

  const handleBackup = async () => {
    setBusy('backup');
    try {
      await createBackup();
      setLastBackup(getLastBackupAt());
      Alert.alert('Backup created', 'Your backup file is ready to save or share.');
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore backup?',
      'This replaces everything currently in the app — including data from either the Android app or the PWA — with the contents of the backup file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file…',
          style: 'destructive',
          onPress: async () => {
            setBusy('restore');
            try {
              const result = await pickAndRestoreBackup();
              if (result) Alert.alert('Restore complete', result.message);
            } catch (e: any) {
              Alert.alert('Restore failed', e?.message ?? 'Something went wrong.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    setCurrentUser(null);
    router.replace('/login');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={styles.title}>Settings</Text>
      {!!username && <Text style={styles.subtitle}>Signed in as {username}</Text>}

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.cardTitle}>Backup & Restore</Text>
        <Text style={styles.cardBody}>
          Last backup: {formatBackupDate(lastBackup)}
        </Text>
        <Text style={[styles.cardBody, { marginTop: spacing.xs }]}>
          Backup files are interchangeable with the web (PWA) version of this app — you can
          restore a backup made on either one here.
        </Text>
        <Button
          label="Create backup"
          onPress={handleBackup}
          loading={busy === 'backup'}
          disabled={busy !== null}
          style={{ marginTop: spacing.md }}
        />
        <Button
          label="Restore from backup…"
          onPress={handleRestore}
          variant="secondary"
          loading={busy === 'restore'}
          disabled={busy !== null}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <Button
        label="Log out"
        onPress={handleLogout}
        variant="danger"
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  cardBody: { fontSize: 13, color: colors.textMuted },
});
