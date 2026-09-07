import { BottomTabBarHeightCallbackContext, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Plus } from 'lucide-react-native';
import { ComponentType, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT, TAB_BAR_INSET } from '../constants/layout';
import { MIN_TOUCH_TARGET, elevation, fontSize, fontWeight, radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

/** The centre button, and how far it rises above the pill. */
const FAB_SIZE = 64;
const FAB_OVERHANG = 34;

export interface TabBarItem {
  name: string;
  label: string;
  Icon: ComponentType<{ color: string; size: number; strokeWidth?: number }>;
}

/**
 * Floating tab bar with a raised centre action.
 *
 * Built as a custom bar rather than styling the stock one because the centre
 * button has to break out above the pill, and a bar with a fixed height clips
 * anything drawn outside it on Android. Here the pill and the button are
 * siblings inside a taller transparent wrapper, so nothing is cut off.
 *
 * Labels stay on. The reference design is icon-only, but this is used
 * one-handed at a market stall by staff who should not have to memorise
 * glyphs — the same reason the previous bar kept them.
 */
export function TabBar({
  state,
  navigation,
  items,
  centre,
}: BottomTabBarProps & {
  /** The four flanking destinations, in order; two are drawn either side. */
  items: TabBarItem[];
  /** The raised middle button — the shop's money action. */
  centre: { name: string; label: string };
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  // The navigator's own guess at the bar height is based on the stock bar, so a
  // custom one has to report itself or every scene under it mispads.
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);

  const go = (name: string) => {
    const route = state.routes.find(candidate => candidate.name === name);
    if (!route) return;

    const focused = state.routes[state.index]?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const isActive = (name: string) => state.routes[state.index]?.name === name;

  const renderItem = (item: TabBarItem) => {
    const active = isActive(item.name);
    const color = active ? colors.primary : colors.textSubtle;

    return (
      <Pressable
        key={item.name}
        onPress={() => go(item.name)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
      >
        <item.Icon color={color} size={active ? 24 : 22} strokeWidth={active ? 2.4 : 2} />
        <Text numberOfLines={1} style={[styles.label, { color, fontWeight: active ? fontWeight.bold : fontWeight.medium }]}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  const [first, second, third, fourth] = items;
  const centreActive = isActive(centre.name);

  return (
    <View
      style={[styles.wrapper, { paddingBottom: insets.bottom + TAB_BAR_INSET }]}
      onLayout={event => reportHeight?.(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: scheme === 'dark' ? colors.surfaceAlt : colors.primaryTint,
            ...elevation(scheme, 2),
          },
        ]}
      >
        {renderItem(first)}
        {renderItem(second)}
        <View style={styles.centreSlot} pointerEvents="none">
          <Text
            numberOfLines={1}
            style={[styles.label, styles.centreLabel, { color: centreActive ? colors.primary : colors.textSubtle }]}
          >
            {centre.label}
          </Text>
        </View>
        {renderItem(third)}
        {renderItem(fourth)}
      </View>

      <Pressable
        onPress={() => go(centre.name)}
        accessibilityRole="tab"
        accessibilityState={{ selected: centreActive }}
        accessibilityLabel={centre.label}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: insets.bottom + TAB_BAR_INSET + TAB_BAR_HEIGHT - FAB_OVERHANG,
            backgroundColor: colors.primary,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            ...elevation(scheme, 3),
            shadowColor: colors.primary,
            shadowOpacity: scheme === 'dark' ? 0.5 : 0.4,
            // The pill is drawn with a ring of page colour around it so the
            // button reads as sitting in front of the bar, not welded into it.
            borderWidth: 4,
            borderColor: colors.background,
          },
        ]}
      >
        <Plus color={colors.textInverse} size={26} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    // Room for the half of the centre button that rises above the pill.
    // Android clips touches on anything drawn outside its parent's bounds, so
    // without this the top of the button would look right and not respond.
    paddingTop: FAB_OVERHANG,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.xs,
    maxWidth: 520,
  },
  item: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centreSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  label: { fontSize: fontSize.xs, textAlign: 'center' },
  centreLabel: { marginBottom: spacing.sm },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
