import React, { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  TextStyle,
  ViewStyle,
  Modal as RNModal,
} from 'react-native';
import { colors, radii, shadows, spacing, tints } from '@/theme/theme';

/**
 * Shared widgets mirroring the PWA's `styles/theme.css` classes and the inline
 * markup its pages repeat (modal overlays, form fields). The class each widget
 * stands in for is named in the comments so the two codebases stay traceable.
 */

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'secondary' | 'danger';
type ButtonSize = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** PWA uses a compact `.btn` (`padding: 8px 12px; font-size: 13px`) for
   *  toolbar rows like Attendance's "Copy Yesterday" / "Clear Day". */
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** PWA `.btn` + `.btn-primary` / `.btn-accent` / `.btn-outline`. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
}: ButtonProps) {
  // `secondary` is the name older screens used; it means the same thing as the
  // PWA's `.btn-outline`, so both spellings resolve to one look.
  const outlined = variant === 'outline' || variant === 'secondary' || variant === 'danger';

  // PWA `.btn-primary:hover` / `.btn-accent:hover` — on touch there is no
  // hover, so the darker/lighter token is the pressed state instead.
  const pressedBg =
    variant === 'accent' ? colors.orangeLight : variant === 'primary' ? colors.maroonDark : tints.primary12;
  const bg = variant === 'accent' ? colors.orange : variant === 'primary' ? colors.maroon : 'transparent';
  const textColor = outlined ? (variant === 'danger' ? colors.danger : colors.maroon) : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        size === 'sm' && styles.btnSm,
        {
          backgroundColor: pressed ? pressedBg : bg,
          borderWidth: outlined ? 2 : 0,
          borderColor: outlined ? (variant === 'danger' ? colors.danger : colors.maroon) : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.btnLabel, size === 'sm' && styles.btnLabelSm, { color: textColor }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** PWA `.card`. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * The PWA draws two overlay shapes by hand: a centred dialog on a
 * `rgba(0,0,0,0.4)` backdrop (Dashboard's "Add Section") and a bottom sheet on
 * `rgba(0,0,0,0.45)` with a 16px top-radius (Learners' "Bulk Upload Names").
 * `variant` picks between them.
 */
export function Modal({
  visible,
  onClose,
  children,
  maxWidth,
  variant = 'center',
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  variant?: 'center' | 'sheet';
}) {
  const sheet = variant === 'sheet';
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.modalBackdrop, sheet ? styles.backdropSheet : styles.backdropCenter]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.modalCard,
            sheet ? styles.modalSheet : styles.modalDialog,
            { maxWidth: maxWidth ?? (sheet ? 480 : 360) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

/**
 * PWA modal headings are bare `<h2>` tags — theme.css resets their margins but
 * not their font-size, so the browser renders them at the UA default 1.5em =
 * 24px bold. The PWA only overrides the colour and the bottom margin, so match
 * that here; screens whose PWA modal uses a tighter `marginBottom: 6/8` pass it
 * through `style`.
 */
export function ModalTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.modalTitle, style]}>{children}</Text>;
}

interface FieldProps {
  /** The PWA only labels some of its inputs (e.g. Learners' quick-add name box
   *  and bulk-upload textarea have none), so this is optional. */
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  helperText?: string;
  autoFocus?: boolean;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** For the inputs the PWA leaves unlabelled, so they keep a screen-reader
   *  name when no visible label is rendered. */
  accessibilityLabel?: string;
}

/** PWA's label + `<input className="input">` pair. */
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
  secureTextEntry,
  autoCapitalize,
  accessibilityLabel,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          // `.input:focus { border-color: var(--color-primary) }`
          focused && { borderColor: colors.maroon },
          multiline && { height: 22 * (numberOfLines ?? 6), textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={accessibilityLabel ?? label}
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
  // .btn — display:inline-flex; gap:8px; padding:12px 20px; radius 8; font 15/600
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.sm,
  },
  // the PWA's compact toolbar button: padding 8px 12px
  btnSm: { paddingVertical: 8, paddingHorizontal: 12 },
  btnLabel: { fontSize: 15, fontWeight: '600' },
  btnLabelSm: { fontSize: 13 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },

  modalBackdrop: { flex: 1, padding: spacing.md },
  backdropCenter: { alignItems: 'center', justifyContent: 'center', backgroundColor: tints.overlay },
  backdropSheet: { alignItems: 'flex-end', justifyContent: 'center', backgroundColor: tints.overlaySheet, padding: 0 },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  // the PWA's centred modal is a `.card` (radius 12) with inline padding 24
  modalDialog: { borderRadius: radii.md },
  // width 100%, maxWidth 480, radius 16 16 0 0, maxHeight 85dvh
  modalSheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.maroon,
    marginBottom: spacing.md,
  },

  field: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  // .input — padding:12px 14px; border:1.5px; radius 8; font 15; bg = surface
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  helperText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },

  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    color: '#FFFFFF',
  },
  optionRow: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  optionRowActive: {
    borderColor: colors.maroon,
    backgroundColor: tints.primary12,
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
