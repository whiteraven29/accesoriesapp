import { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  AccentSet,
  HIT_SLOP,
  MIN_TOUCH_TARGET,
  elevation,
  fontSize,
  fontWeight,
  radius,
  spacing,
} from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** A pastel chip colour, chosen for contrast between neighbours rather than meaning. */
export type Accent = keyof AccentSet;

/** Resolves a tone to its solid colour and matching tint. */
export function useTone(tone: Tone) {
  const { colors } = useTheme();
  const map: Record<Tone, { solid: string; tint: string }> = {
    primary: { solid: colors.primary, tint: colors.primaryTint },
    success: { solid: colors.success, tint: colors.successTint },
    warning: { solid: colors.warning, tint: colors.warningTint },
    danger: { solid: colors.danger, tint: colors.dangerTint },
    info: { solid: colors.info, tint: colors.infoTint },
    neutral: { solid: colors.textMuted, tint: colors.surfaceSunken },
  };
  return map[tone];
}

/** Resolves one of the six pastel category colours to glyph + backing tint. */
export function useAccent(accent: Accent) {
  const { colors } = useTheme();
  return { solid: colors.accent[accent], tint: colors.accentTint[accent] };
}

/**
 * The app's base surface: white, borderless, floating on a wide soft shadow.
 *
 * Dark mode keeps a hairline because a raised surface reads only by its edge
 * once the shadow has nothing left to darken.
 */
export function Card({
  children,
  style,
  padded = true,
  raised = 1,
}: {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  raised?: 1 | 2 | 3;
}) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
          ...elevation(scheme, raised),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Pastel rounded square behind a glyph — the kit's category marker. */
export function IconChip({
  children,
  accent = 'violet',
  size = 44,
  style,
}: {
  children: ReactNode;
  accent?: Accent;
  size?: number;
  style?: ViewStyle;
}) {
  const { tint } = useAccent(accent);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 3.2,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  variant = 'solid',
  icon,
  disabled,
  loading,
  fullWidth,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  variant?: 'solid' | 'soft' | 'ghost';
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
}) {
  const { colors, scheme } = useTheme();
  const { solid, tint } = useTone(tone);
  const inactive = disabled || loading;

  const background = variant === 'solid' ? solid : variant === 'soft' ? tint : 'transparent';
  const foreground = variant === 'solid' ? colors.textInverse : solid;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH_TARGET + spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: background,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: inactive ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          // Only the filled brand button lifts; soft and ghost stay flat so a
          // row of secondary actions does not read as a pile of cards.
          ...(variant === 'solid' && !inactive ? elevation(scheme, 1) : null),
          ...(variant === 'solid' && !inactive ? { shadowColor: solid, shadowOpacity: 0.32 } : null),
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : icon}
      <Text style={{ color: foreground, fontWeight: fontWeight.bold, fontSize: fontSize.lg }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Small status pill — stock state, payment method, unit condition. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { solid, tint } = useTone(tone);
  return (
    <View
      style={{
        backgroundColor: tint,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 1,
        borderRadius: radius.pill,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: solid, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Section title with the kit's small count bubble beside it — "In Progress 6".
 * The count is what stops a long screen of stacked cards reading as one list.
 */
export function SectionHeading({
  title,
  count,
  action,
  style,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionRow, style]}>
      <View style={styles.sectionTitleGroup}>
        <Text
          style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text }}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {typeof count === 'number' ? (
          <View style={[styles.countBubble, { backgroundColor: colors.primaryTint }]}>
            <Text style={{ color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/**
 * Circular percentage gauge. The kit puts one on every task group row, which is
 * the single cheapest way to make a list of counts feel like progress.
 */
export function ProgressRing({
  value,
  size = 52,
  thickness = 5,
  accent = 'violet',
  label,
  showValue = true,
}: {
  /** 0–100. Values outside the range are clamped rather than overdrawn. */
  value: number;
  size?: number;
  thickness?: number;
  accent?: Accent;
  label?: string;
  /** Off when the caller draws its own readout — e.g. in white on a filled card. */
  showValue?: boolean;
}) {
  const { colors } = useTheme();
  const { solid, tint } = useAccent(accent);
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={solid}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - pct / 100)}
          // Start the sweep at twelve o'clock instead of three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showValue ? (
        <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.text }}>
          {Math.round(pct)}%
        </Text>
      ) : null}
    </View>
  );
}

/** Flat companion to ProgressRing, for the kit's wide "in progress" cards. */
export function ProgressBar({
  value,
  accent = 'blue',
  track,
  label,
}: {
  /** 0–100, clamped. */
  value: number;
  accent?: Accent;
  track?: string;
  label?: string;
}) {
  const { colors } = useTheme();
  const { solid } = useAccent(accent);
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <View
      style={{ height: 7, borderRadius: radius.pill, backgroundColor: track ?? colors.surface, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: radius.pill, backgroundColor: solid }} />
    </View>
  );
}

/**
 * Dashboard/report metric tile. Previously duplicated as a `StatCard` defined
 * inside the render body of both the dashboard and the reports screen, which
 * remounted every tile on each state change.
 */
export function StatTile({
  label,
  value,
  icon,
  tone = 'primary',
  accent,
  trend,
  caption,
  style,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: Tone;
  /** Overrides `tone` for the icon chip only, to colour a grid by position. */
  accent?: Accent;
  trend?: { direction: 'up' | 'down'; value: number };
  caption?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const { solid, tint } = useTone(tone);
  const chipTint = accent ? colors.accentTint[accent] : tint;
  const trendColor = trend?.direction === 'up' ? colors.success : colors.danger;
  const trendTint = trend?.direction === 'up' ? colors.successTint : colors.dangerTint;

  return (
    <Card style={style}>
      <View style={styles.tileHeader}>
        {icon ? <View style={[styles.tileIcon, { backgroundColor: chipTint }]}>{icon}</View> : null}
        {trend ? (
          <View style={[styles.trendPill, { backgroundColor: trendTint }]}>
            <Text style={{ color: trendColor, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
              {trend.direction === 'up' ? '▲' : '▼'} {Math.abs(trend.value).toFixed(1)}%
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: solid, marginTop: spacing.md }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs }}>{label}</Text>
      {caption ? (
        <Text style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs }}>{caption}</Text>
      ) : null}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      {icon}
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: colors.text,
          marginTop: spacing.md,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontSize: fontSize.md,
            color: colors.textMuted,
            marginTop: spacing.xs,
            textAlign: 'center',
            maxWidth: 420,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

/** Field label + value row used across receipts, checkout and detail sheets. */
export function DetailRow({
  label,
  value,
  emphasis,
  valueStyle,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueStyle?: TextStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{label}</Text>
      <Text
        style={[
          {
            color: colors.text,
            fontSize: emphasis ? fontSize.lg : fontSize.md,
            fontWeight: emphasis ? fontWeight.bold : fontWeight.medium,
          },
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Horizontal choice group — payment method, category, report period.
 *
 * The kit draws these as free-floating pills rather than segments inside a
 * sunken track: the selected one is filled brand, the rest are its pale tint.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const segmentStyles = useMemo(
    () =>
      StyleSheet.create({
        group: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
      }),
    [],
  );

  return (
    <View style={segmentStyles.group} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={{
              flex: 1,
              minHeight: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: selected ? colors.primary : colors.primaryTint,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: selected ? colors.textInverse : colors.primary,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.md,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  trendPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countBubble: {
    minWidth: 24,
    height: 24,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
});
