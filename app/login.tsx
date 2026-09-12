import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { loginUser, registerUser } from '@/db/repositories/users';
import { setCurrentUser } from '@/db/repositories/settings';
import { Button, Field } from '@/components/ui';
import { colors, radii, shadows, spacing } from '@/theme/theme';

/**
 * Mirrors the PWA's pages/Login.tsx: `linear-gradient(160deg, #F1E5A1 0%,
 * #fdfaf0 60%)` page background, a white 16px-radius card on the "hero" shadow,
 * the 72px maroon SHS roundel, labelled inputs, a tinted error box and the
 * orange register/login toggle with the tagline underneath.
 *
 * Two deliberate platform adaptations: the PWA's "Progressive Web App • Offline
 * Ready" subtitle becomes "Offline Ready" (there is no browser here), and the
 * submit button shows the app's spinner instead of the PWA's "Please wait…"
 * label.
 */
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const trimmed = username.trim();
    // The PWA leans on the browser's `required` attributes; on Android we have
    // to check it ourselves.
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
          return;
        }
      } else {
        const ok = await loginUser(trimmed, password);
        if (!ok) {
          setError('Invalid username or password');
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
    // CSS 160deg runs 160° clockwise from "to top", i.e. down and slightly
    // left; these endpoints reproduce that direction, clipped at the PWA's 60%
    // colour stop.
    <LinearGradient
      colors={[colors.cream, colors.background]}
      locations={[0, 0.6]}
      start={{ x: 0.33, y: 0 }}
      end={{ x: 0.67, y: 1 }}
      style={styles.screen}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.brand}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>SHS</Text>
              </View>
              <Text style={styles.title}>SHS Class Record</Text>
              <Text style={styles.subtitle}>Offline Ready</Text>
            </View>

            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button
              label={isRegister ? 'Create Account' : 'Login'}
              onPress={handleSubmit}
              loading={loading}
              style={styles.submit}
            />

            <Text style={styles.toggleRow}>
              {isRegister ? 'Already have an account?' : 'First time here?'}{' '}
              <Text
                style={styles.toggleLink}
                onPress={() => {
                  setIsRegister((v) => !v);
                  setError('');
                }}
              >
                {isRegister ? 'Login' : 'Register'}
              </Text>
            </Text>
          </View>

          <Text style={styles.tagline}>Secure • Offline • DepEd-aligned</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 32,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.hero,
  },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: '#FFFFFF', fontWeight: '700', fontSize: 28 },
  title: { fontSize: 22, fontWeight: '700', color: colors.maroon, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textMuted },
  error: {
    backgroundColor: colors.errorBg,
    color: colors.maroon,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    fontSize: 13,
    marginBottom: 14,
  },
  submit: { width: '100%', marginBottom: 12 },
  toggleRow: { textAlign: 'center', fontSize: 13, color: colors.textMuted },
  toggleLink: { color: colors.orange, fontWeight: '600' },
  tagline: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.maroon,
    opacity: 0.7,
  },
});
