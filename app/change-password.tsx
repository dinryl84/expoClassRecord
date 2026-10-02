import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/Header';
import { Button, Card, Field } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { getCurrentUser } from '@/db/repositories/settings';
import { changePassword } from '@/db/repositories/users';

export default function ChangePassword() {
  const username = getCurrentUser();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleChange = async () => {
    setError('');
    if (!username) {
      setError('You are not signed in.');
      return;
    }
    if (!currentPw || !newPw) {
      setError('Enter your current password and a new password.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const ok = await changePassword(username, currentPw, newPw);
      if (!ok) {
        setError('Current password is incorrect.');
        return;
      }
      Alert.alert('Password changed', 'Use your new password the next time you log in.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header title="Change Password" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md }} keyboardShouldPersistTaps="handled">
        {!!username && <Text style={styles.signedIn}>Account: {username}</Text>}
        <Card style={{ marginTop: spacing.sm }}>
          <Field
            label="Current password"
            value={currentPw}
            onChangeText={setCurrentPw}
            secureTextEntry
            autoCapitalize="none"
          />
          <Field
            label="New password"
            value={newPw}
            onChangeText={setNewPw}
            secureTextEntry
            autoCapitalize="none"
          />
          <Field
            label="Confirm new password"
            value={confirmPw}
            onChangeText={setConfirmPw}
            secureTextEntry
            autoCapitalize="none"
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button
            label={busy ? 'Changing…' : 'Change password'}
            onPress={handleChange}
            loading={busy}
            disabled={busy}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  signedIn: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  error: { color: colors.maroon, fontSize: 13, marginTop: 4 },
});
