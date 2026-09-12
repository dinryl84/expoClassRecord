import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme/theme';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/db/repositories/settings';

/**
 * `app/index.tsx` only runs its login check when the app is opened at the
 * root route. With expo-router, a deep link or a restored navigation state
 * can land directly on e.g. `/dashboard` without ever touching index.tsx,
 * bypassing the login gate. This guard re-checks on every route change and
 * bounces back to `/login` if nobody is signed in.
 */
function useAuthGuard() {
  const segments = useSegments();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getDb(); // opens the db + runs migrations (no-op if already open)
    const loggedIn = !!getCurrentUser();
    const first = segments[0] as string | undefined;
    const onRoot = first === undefined;
    const onLogin = first === 'login';

    if (!loggedIn && !onRoot && !onLogin) {
      router.replace('/login');
    }
    setReady(true);
  }, [segments, router]);

  return ready;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const ready = useAuthGuard();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.maroon} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}
        />
      </AuthGate>
    </SafeAreaProvider>
  );
}
