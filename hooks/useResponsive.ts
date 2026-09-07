import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS, DeviceSize, getDeviceSize } from '../constants/layout';

export interface Responsive {
  width: number;
  height: number;
  size: DeviceSize;
  /** Below the tablet breakpoint: one column, stacked controls. */
  isPhone: boolean;
  isTablet: boolean;
  /** At or above `lg`: the persistent sidebar and multi-column layouts appear. */
  isDesktop: boolean;
  isLandscape: boolean;
  /** Columns for card grids, derived once so screens stop each inventing it. */
  columns: number;
}

/**
 * Replaces the ad-hoc `width > 768` checks that were scattered across screens.
 * Memoised so the object identity is stable between renders at the same size.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const size = getDeviceSize(width);
    return {
      width,
      height,
      size,
      isPhone: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isLandscape: width > height,
      columns: width >= BREAKPOINTS.xl ? 4 : width >= BREAKPOINTS.lg ? 3 : width >= BREAKPOINTS.md ? 2 : 1,
    };
  }, [width, height]);
}
