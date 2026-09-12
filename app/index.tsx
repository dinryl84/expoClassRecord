import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/db/repositories/settings';
import { colors } from '@/theme/theme';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    getDb(); // opens the db + runs migrations
    setLoggedIn(!!getCurrentUser());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.maroon} size="large" />
      </View>
    );
  }

  return <Redirect href={loggedIn ? '/dashboard' : '/login'} />;
}
