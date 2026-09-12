import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Section } from '@/types';

export function DuplicateBanner({ section }: { section: Section }) {
  if (!section.isDuplicate) return null;
  const when = section.duplicatedAt ? new Date(section.duplicatedAt).toLocaleDateString() : '';
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        ⧉ DUPLICATE — copy of "{section.duplicatedFromName ?? 'a previous section'}"
        {when ? ` · made ${when}` : ''} · editing here won't affect the original
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#F0D98C',
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  text: {
    color: '#7A5B00',
    fontSize: 12,
    fontWeight: '600',
  },
});
