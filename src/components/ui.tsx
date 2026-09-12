import React from 'react';
import {
  Pressable,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  Modal as RNModal,
} from 'react-native';
import { colors, radii, spacing } from '@/theme/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const bg =
    variant === 'primary' ? colors.maroon : variant === 'danger' ? colors.danger : colors.surface;
  const textColor = variant === 'secondary' ? colors.maroon : '#FFFFFF';
  const borderColor = variant === 'secondary' ? colors.maroon : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Modal({
  visible,
  onClose,
  children,
  maxWidth = 380,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalCard, { maxWidth }]} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

export function ModalTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.modalTitle}>{children}</Text>;
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  helperText?: string;
  autoFocus?: boolean;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  numberOfLines?: number;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  autoFocus,
  keyboardType = 'default',
  multiline,
  numberOfLines,
}: FieldProps) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 22 * (numberOfLines ?? 6), textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
      />
      {!!helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OptionList<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[styles.optionRow, active && styles.optionRowActive]}
          >
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.maroon,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  helperText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  segmentBtnActive: {
    backgroundColor: colors.maroon,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  segmentLabelActive: {
    color: '#fff',
  },
  optionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
  },
  optionRowActive: {
    borderColor: colors.maroon,
    backgroundColor: '#FBEFE9',
  },
  optionLabel: {
    fontSize: 13,
    color: colors.text,
  },
  optionLabelActive: {
    color: colors.maroon,
    fontWeight: '700',
  },
});
