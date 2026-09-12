import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/theme';

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
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
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
  header: {
    backgroundColor: colors.maroon,
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 32 },
  backText: { color: '#fff', fontSize: 22 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, textAlign: 'center', marginTop: 2 },
  rightBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rightText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
