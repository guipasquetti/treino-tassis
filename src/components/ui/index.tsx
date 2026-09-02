import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontSize, Palette, Radius, Spacing } from '@/theme';

/** Tela com fundo preto, título grande e conteúdo rolável — padrão da referência. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={styles.scrollContent}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Body({
  children,
  color = Palette.text,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.body, { color }, style]}>{children}</Text>;
}

export function Caption({
  children,
  color = Palette.textSecondary,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.caption, { color }, style]}>{children}</Text>;
}

/** Número grande com rótulo — o "stat tile" da referência. */
export function Stat({ value, label, color = Palette.text }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Pill({
  label,
  active,
  color = Palette.accent,
  onPress,
}: {
  label: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active ? { backgroundColor: color } : styles.pillInactive]}>
      <Text style={[styles.pillText, active ? styles.pillTextActive : undefined]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  color = Palette.accent,
  variant = 'solid',
  disabled,
  loading,
}: {
  label: string;
  onPress?: () => void;
  color?: string;
  variant?: 'solid' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        solid ? { backgroundColor: color } : styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.cardPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={solid ? Palette.text : color} />
      ) : (
        <Text style={[styles.buttonText, !solid && { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Botão redondo de +/- usado no registro de séries. */
export function StepperButton({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.stepper, pressed && styles.cardPressed]}>
      <Ionicons name={icon} size={20} color={Palette.text} />
    </Pressable>
  );
}

/** Campo de texto com rótulo — base dos formulários do profissional. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Palette.textTertiary}
        keyboardType={keyboardType}
      />
    </View>
  );
}

/** Linha com rótulo e switch. */
export function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.caption, { color: Palette.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: Palette.green, false: Palette.surfaceElevated }}
      />
    </View>
  );
}

/** Botão pequeno de remover, usado em listas editáveis. */
export function RemoveButton({ onPress, label = 'Remover' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.cardPressed]}>
      <Text style={styles.removeText}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <Caption>{text}</Caption>
    </Card>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={Palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Palette.text,
    fontSize: FontSize.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.textSecondary,
    fontSize: FontSize.small,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardPressed: {
    opacity: 0.7,
  },
  sectionTitle: {
    color: Palette.textSecondary,
    fontSize: FontSize.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
  },
  body: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
  caption: {
    fontSize: FontSize.small,
    fontWeight: '500',
    lineHeight: 20,
  },
  stat: {
    gap: 2,
  },
  statValue: {
    fontSize: FontSize.stat,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Palette.textSecondary,
    fontSize: FontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  pillInactive: {
    backgroundColor: Palette.surfaceElevated,
  },
  pillText: {
    color: Palette.textSecondary,
    fontSize: FontSize.small,
    fontWeight: '700',
  },
  pillTextActive: {
    color: Palette.text,
  },
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: {
    backgroundColor: Palette.surfaceElevated,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: Palette.text,
    fontSize: FontSize.body,
    fontWeight: '700',
  },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.background,
  },
  field: {
    gap: Spacing.xs,
    flex: 1,
  },
  fieldLabel: {
    color: Palette.textSecondary,
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Palette.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Palette.text,
    fontSize: FontSize.body,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeText: {
    color: Palette.danger,
    fontSize: FontSize.small,
    fontWeight: '700',
  },
});
