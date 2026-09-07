import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react-native';
import { APP_NAME } from '../constants/app';
import { SIDEBAR_WIDTH } from '../constants/layout';
import { MIN_TOUCH_TARGET, fontSize, fontWeight, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { STORAGE_KEYS, storage } from '../utils/storage';

const COLLAPSED_WIDTH = 68;

/**
 * Desktop navigation rail.
 *
 * Replaces the stock left tab bar, which laid its items out in a fixed column:
 * once the shop had ten destinations the last few fell off the bottom of a
 * short window with no way to reach them. This scrolls, and collapses to icons
 * so a 1280px laptop keeps its width for the actual work.
 */
export function WebSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    storage.get(STORAGE_KEYS.sidebarCollapsed).then(saved => {
      if (saved === 'true') setCollapsed(true);
    });
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      void storage.set(STORAGE_KEYS.sidebarCollapsed, String(!prev));
      return !prev;
    });
  };

  const width = collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <View
      style={[styles.rail, { width, backgroundColor: colors.surface, borderRightColor: colors.border }]}
    >
      <View style={[styles.header, collapsed && styles.headerCollapsed]}>
        {!collapsed ? (
          <Text style={[styles.brand, { color: colors.text }]} numberOfLines={1}>
            {APP_NAME}
          </Text>
        ) : null}
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          accessibilityState={{ expanded: !collapsed }}
          style={({ pressed }) => [
            styles.toggle,
            { backgroundColor: pressed ? colors.surfaceSunken : 'transparent' },
          ]}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} color={colors.textMuted} />
          ) : (
            <PanelLeftClose size={18} color={colors.textMuted} />
          )}
        </Pressable>
      </View>

      {/* Scrolls, so no destination can be pushed out of reach. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // expo-router marks a hidden screen with `href: null` (not part of the
          // React Navigation options type, hence the cast). Screens hidden this
          // way still reach a custom tab bar, so filter them here — and treat a
          // missing icon as hidden too, since every rail item defines one.
          const hidden = (options as { href?: string | null }).href === null;
          if (hidden || !options.tabBarIcon) return null;

          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const color = focused ? colors.primary : colors.textMuted;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="link"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.item,
                collapsed && styles.itemCollapsed,
                {
                  backgroundColor: focused
                    ? colors.primaryTint
                    : pressed
                      ? colors.surfaceSunken
                      : 'transparent',
                },
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 20 })}
              {!collapsed ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color, fontWeight: focused ? fontWeight.semibold : fontWeight.medium },
                  ]}
                >
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { height: '100%', borderRightWidth: 1, paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerCollapsed: { justifyContent: 'center', paddingHorizontal: spacing.xs },
  brand: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1 },
  toggle: {
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.sm, gap: 2, paddingBottom: spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
  },
  itemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  label: { fontSize: fontSize.md, flex: 1 },
});
