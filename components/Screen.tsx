import { ReactNode, useContext, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { CONTENT_MAX_WIDTH } from '../constants/layout';
import { fontSize, fontWeight, spacing } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import { useTheme } from '../hooks/useTheme';

type Measure = keyof typeof CONTENT_MAX_WIDTH;

/**
 * Fades a `#RRGGBB` token to a given alpha.
 *
 * Gradients must fade to a zero-alpha copy of their own hue, not to
 * `transparent` — on iOS that keyword interpolates through transparent *black*
 * and leaves a grey bruise through the middle of the wash.
 */
const fade = (hex: string, alpha: number) => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * The ambient wash behind every page.
 *
 * Two cheap linear passes rather than a real mesh or a full-screen SVG: this
 * ships to budget Android handsets used in daylight, and the effect is faint
 * enough that the extra fidelity would not survive the screen anyway.
 */
export function AuroraBackground() {
  const { colors } = useTheme();
  const [mint, butter, sky] = colors.aurora;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[fade(mint, 0.55), fade(mint, 0), fade(butter, 0.5)]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[fade(sky, 0.45), fade(sky, 0)]}
        locations={[0, 0.6]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0.15 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Centres page content and caps its width.
 *
 * Four screens previously rendered edge-to-edge on desktop while sizing their
 * interior from a viewport clamped to 480px, so a 1920px monitor showed
 * phone-scale text stretched across the full width. Wrapping content here fixes
 * that without touching each screen's internals.
 */
export function ContentContainer({
  children,
  measure = 'wide',
  style,
}: {
  children: ReactNode;
  measure?: Measure;
  style?: StyleProp<ViewStyle>;
}) {
  const { isPhone } = useResponsive();

  return (
    <View
      style={[
        styles.content,
        { maxWidth: CONTENT_MAX_WIDTH[measure], paddingHorizontal: isPhone ? spacing.lg : spacing.xl },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Page shell: washed background plus a centred, width-capped column. */
export function Screen({
  children,
  measure = 'wide',
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  measure?: Measure;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  const { colors } = useTheme();
  /**
   * The tab bar floats clear of the bottom edge and so takes no layout space.
   * Content is padded past it here rather than by insetting the scene, which
   * would stop the page wash short of the bottom and leave a visible seam.
   * Undefined on screens outside the tab navigator, such as sign-in.
   */
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  if (!scroll) {
    return (
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <AuroraBackground />
        <ContentContainer measure={measure} style={[{ paddingBottom: tabBarHeight }, contentStyle]}>
          {children}
        </ContentContainer>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <AuroraBackground />
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxxl + tabBarHeight }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        <ContentContainer measure={measure} style={contentStyle}>
          {children}
        </ContentContainer>
      </ScrollView>
    </View>
  );
}

/** Consistent page title block, replacing seven bespoke header styles. */
export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { colors } = useTheme();
  const { isPhone } = useResponsive();

  const headerStyles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: isPhone ? 'column' : 'row',
          alignItems: isPhone ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingVertical: spacing.xl,
        },
        title: {
          fontSize: isPhone ? fontSize.xxxl : fontSize.display,
          fontWeight: fontWeight.bold,
          color: colors.text,
          letterSpacing: -0.5,
        },
        subtitle: {
          marginTop: spacing.xs,
          fontSize: fontSize.md,
          color: colors.textMuted,
        },
        actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
      }),
    [colors, isPhone],
  );

  return (
    <View style={headerStyles.row}>
      <View style={styles.flex}>
        <Text style={headerStyles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={headerStyles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: spacing.xxxl },
  content: { width: '100%', alignSelf: 'center', flex: 1 },
  flex: { flex: 1 },
});
