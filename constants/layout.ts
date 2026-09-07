/**
 * The single breakpoint source for the app.
 *
 * Before this existed the codebase carried six competing scales (480/768/1024/
 * 1440 in the native tab bar, 900 for the web sidebar, 1024 on the dashboard,
 * 800 on More, 768 on Products, 700 on Expenses, 600 and 768 inside the POS).
 * That produced windows where a desktop sidebar sat beside a mobile dashboard.
 */
export const BREAKPOINTS = {
  /** Compact phones. Below this, drop to single column and shorten labels. */
  xs: 360,
  /** Phone / large phone boundary. */
  sm: 480,
  /** Large phone to tablet. Two-column grids become viable. */
  md: 768,
  /** Tablet to desktop. The persistent sidebar appears here. */
  lg: 1024,
  /** Wide desktop. Content stops growing and centres. */
  xl: 1440,
} as const;

export type DeviceSize = 'phone' | 'largePhone' | 'tablet' | 'desktop' | 'wide';

export const getDeviceSize = (width: number): DeviceSize => {
  if (width >= BREAKPOINTS.xl) return 'wide';
  if (width >= BREAKPOINTS.lg) return 'desktop';
  if (width >= BREAKPOINTS.md) return 'tablet';
  if (width >= BREAKPOINTS.sm) return 'largePhone';
  return 'phone';
};

/**
 * Maximum width of a centred content column, by screen kind. Reading measure
 * stops growing well before the monitor does; the rest becomes gutter.
 */
export const CONTENT_MAX_WIDTH = {
  /** Dense record screens: tables, dashboards, reports. */
  wide: 1180,
  /** List and form screens where a narrower measure reads better. */
  standard: 900,
  /** Modals and focused single-task panels. */
  narrow: 640,
} as const;

/** Width of the persistent navigation rail on desktop web. */
export const SIDEBAR_WIDTH = 260;

/** Minimum width a data table needs before it must scroll horizontally. */
export const TABLE_MIN_WIDTH = 720;

/**
 * The floating tab bar's pill and the gap it keeps from the bottom edge.
 *
 * The clearance a screen needs below its content is not derived from these:
 * the bar measures itself and publishes the result, safe-area and the centre
 * button's overhang included, which `Screen` then reads.
 */
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_INSET = 12;
