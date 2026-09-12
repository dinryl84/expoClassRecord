import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { loginUser, registerUser } from '@/db/repositories/users';
import { setCurrentUser } from '@/db/repositories/settings';
import { Button } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/theme';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const trimmed = username.trim();
    if (!trimmed || !password) {
      setError('Enter a username and password');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        const ok = await registerUser(trimmed, password);
        if (!ok) {
          setError('Username already exists');
          setLoading(false);
          return;
        }
      } else {
        const ok = await loginUser(trimmed, password);
        if (!ok) {
          setError('Invalid username or password');
          setLoading(false);
          return;
        }
      }
      setCurrentUser(trimmed);
      router.replace('/dashboard');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>SHS</Text>
        </View>
        <Text style={styles.title}>Class Record</Text>
        <Text style={styles.subtitle}>Baganga National High School</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          label={isRegister ? 'Create account' : 'Log in'}
          onPress={handleSubmit}
          loading={loading}
          style={{ marginTop: spacing.sm, width: '100%' }}
        />

        <Text
          style={styles.toggle}
          onPress={() => {
            setError('');
            setIsRegister((v) => !v);
          }}
        >
          {isRegister ? 'Already have an account? Log in' : 'New here? Create an account'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: { color: '#fff', fontWeight: '700', fontSize: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 2 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm, textAlign: 'center' },
  toggle: { marginTop: spacing.md, color: colors.maroon, fontSize: 13, fontWeight: '600' },
});
