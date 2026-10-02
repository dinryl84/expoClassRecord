import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/Header';
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
    <View style={styles.screen}>
      <Header title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {!!username && <Text style={styles.signedIn}>Signed in as {username}</Text>}

        <Card style={{ marginTop: spacing.sm }}>
          {/* PWA card heading is a plain <div>: default size (16px) / 600 / text, marginBottom 4 */}
          <Text style={styles.cardTitle}>Backup & Restore</Text>
          {/* PWA "Last backup:" line: 12px muted, with the date in bold text colour */}
          <Text style={[styles.cardBody, { marginBottom: 10 }]}>
            Last backup: <Text style={styles.cardBodyStrong}>{formatBackupDate(lastBackup)}</Text>
          </Text>
          <Text style={[styles.cardBody, { marginBottom: 10 }]}>
            Backup files are interchangeable with the web (PWA) version of this app — you can
            restore a backup made on either one here.
          </Text>
          {/* PWA backup action is `.btn-accent` (orange), full width */}
          <Button
            label="Create backup"
            variant="accent"
            onPress={handleBackup}
            loading={busy === 'backup'}
            disabled={busy !== null}
          />
          {/* PWA restore action is `.btn-outline` (maroon outline), full width */}
          <Button
            label="Restore from backup…"
            onPress={handleRestore}
            variant="secondary"
            loading={busy === 'restore'}
            disabled={busy !== null}
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.cardTitle}>Password</Text>
          <Text style={[styles.cardBody, { marginBottom: 10 }]}>
            Change the password for {username ?? 'this account'}. You need your current password.
          </Text>
          <Button label="Change password" variant="secondary" onPress={() => router.push('/change-password')} />
        </Card>

        <Button label="Log out" onPress={handleLogout} variant="danger" style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  signedIn: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  // PWA plain <div> card headings (Backup & Restore / Storage Protection): 16px / 600 / text
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  cardBody: { fontSize: 12, color: colors.textMuted },
  cardBodyStrong: { color: colors.text, fontWeight: '700' },
});
