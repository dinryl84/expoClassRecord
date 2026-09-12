import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, tints } from '@/theme/theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
}

export function Header({ title, subtitle, onBack, rightLabel, onRightPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightLabel ? (
          <Pressable onPress={onRightPress} style={styles.rightBtn}>
            <Text style={styles.rightText}>{rightLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // PWA `.header` — maroon, padding 14px 16px, title 18px/700
  header: {
    backgroundColor: colors.maroon,
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 32 },
  backText: { color: '#FFFFFF', fontSize: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, textAlign: 'center', marginTop: 2 },
  // the PWA's header action pill (e.g. Dashboard's ⚙ / Logout)
  rightBtn: {
    backgroundColor: tints.onPrimarySoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  // The PWA's header pills set no font-weight, so they render at the default
  // 400 — matching that keeps this in step with the screen-local pills.
  rightText: { color: '#FFFFFF', fontSize: 13 },
});
