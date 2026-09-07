/**
 * DukaSmart design tokens.
 *
 * Every colour, space and type size in the app resolves from here so that a
 * screen cannot drift into its own private scale. Light and dark palettes carry
 * the same key set, which is what lets `useTheme` swap them at runtime.
 *
 * The visual language is borrowed from a soft-card task-manager kit: a vivid
 * violet brand over a pale lavender ground, white cards with no border and a
 * wide diffuse shadow, pastel icon chips, and pill-shaped controls. The kit was
 * drawn for a to-do app, so the parts that carry money — profit, loss, stock
 * warnings — keep their semantic green/amber/red rather than going violet.
 */

export type ColorScheme = 'light' | 'dark';

/**
 * The six pastel chip colours the kit uses to tell categories apart at a
 * glance. Each is a tinted square behind a saturated glyph; they carry no
 * meaning on their own, so a screen may assign them freely.
 */
export interface AccentSet {
  violet: string;
  pink: string;
  orange: string;
  blue: string;
  green: string;
  yellow: string;
}

export interface Palette {
  // Surfaces, back to front.
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;

  // Content.
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;

  // Brand and state. Each has a solid tone plus a tinted background used for
  // badges, icon chips and banners.
  primary: string;
  primaryPressed: string;
  primaryTint: string;
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  dangerTint: string;
  info: string;
  infoTint: string;

  // Pastel category chips: saturated glyph over its own tint.
  accent: AccentSet;
  accentTint: AccentSet;

  /**
   * Four stops for the ambient mesh wash behind a page. The kit never shows a
   * flat background — there is always a faint mint/yellow/blue bloom drifting
   * across it. Ordered top-left, top-right, bottom-left, bottom-right.
   */
  aurora: [string, string, string, string];

  // Fixed overlays that must not invert with the scheme.
  overlay: string;
  shadow: string;
}

const light: Palette = {
  background: '#F2F0FD',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF9FE',
  surfaceSunken: '#EDEAFC',
  border: '#E7E3F8',
  borderStrong: '#D3CCF0',

  text: '#171129',
  textMuted: '#635C7A',
  textSubtle: '#9A93AF',
  textInverse: '#FFFFFF',

  primary: '#5F33E1',
  primaryPressed: '#4A25C4',
  primaryTint: '#EAE4FD',
  success: '#16A34A',
  successTint: '#DCFCE7',
  warning: '#EA7B12',
  warningTint: '#FDEBD6',
  danger: '#E11D48',
  dangerTint: '#FDE4EA',
  info: '#2A9DF4',
  infoTint: '#DEF0FE',

  accent: {
    violet: '#5F33E1',
    pink: '#EC4899',
    orange: '#EE7214',
    blue: '#2A9DF4',
    green: '#16A34A',
    yellow: '#CA9A04',
  },
  accentTint: {
    violet: '#EAE4FD',
    pink: '#FCE4EF',
    orange: '#FCE6D3',
    blue: '#DEF0FE',
    green: '#DCFCE7',
    yellow: '#FEF3C7',
  },

  aurora: ['#DFF5E6', '#FDF6DA', '#E2EEFB', '#F2F0FD'],

  overlay: 'rgba(23, 17, 41, 0.55)',
  shadow: '#3B2C6B',
};

const dark: Palette = {
  background: '#110E1D',
  surface: '#1B1730',
  surfaceAlt: '#221D3A',
  surfaceSunken: '#171327',
  border: '#2C2547',
  borderStrong: '#3E3560',

  text: '#F3F0FF',
  textMuted: '#B0A8CB',
  textSubtle: '#7A7196',
  textInverse: '#110E1D',

  // Brand tones are lifted for contrast against dark surfaces; the tints become
  // low-alpha washes rather than pastels so they stay legible.
  primary: '#A78BFA',
  primaryPressed: '#8B5CF6',
  primaryTint: 'rgba(167, 139, 250, 0.18)',
  success: '#4ADE80',
  successTint: 'rgba(74, 222, 128, 0.16)',
  warning: '#FBBF24',
  warningTint: 'rgba(251, 191, 36, 0.16)',
  danger: '#FB7185',
  dangerTint: 'rgba(251, 113, 133, 0.16)',
  info: '#60C4FF',
  infoTint: 'rgba(96, 196, 255, 0.16)',

  accent: {
    violet: '#A78BFA',
    pink: '#F472B6',
    orange: '#FB923C',
    blue: '#60C4FF',
    green: '#4ADE80',
    yellow: '#FBBF24',
  },
  accentTint: {
    violet: 'rgba(167, 139, 250, 0.18)',
    pink: 'rgba(244, 114, 182, 0.18)',
    orange: 'rgba(251, 146, 60, 0.18)',
    blue: 'rgba(96, 196, 255, 0.18)',
    green: 'rgba(74, 222, 128, 0.18)',
    yellow: 'rgba(251, 191, 36, 0.18)',
  },

  // The same bloom, dropped to near-black so it reads as depth, not colour.
  aurora: ['#17203A', '#1E1A33', '#141A2E', '#110E1D'],

  overlay: 'rgba(6, 4, 12, 0.7)',
  shadow: '#000000',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

/** 4pt spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Corner radii.
 *
 * The kit rounds harder than the old scale did: cards sit at 24 and controls at
 * 16, which is what makes a dense list of numbers still read as soft.
 */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

/**
 * Absolute type scale.
 *
 * The old screens derived every size from a viewport clamped to 480px, so body
 * text rendered at 19px and headings at 29px — about a third too large, and
 * identical on a phone and a 27" monitor. Sizes are fixed here; only layout
 * responds to width.
 */
export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 26,
  display: 32,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Minimum touch target. Market stalls are used one-handed, often in sunlight. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH_TARGET = 44;

/**
 * Card and control shadows.
 *
 * Wider and fainter than a stock material shadow, and tinted violet rather than
 * grey — the kit's cards look like they are floating a long way above the page
 * rather than sitting a pixel off it.
 */
export const elevation = (scheme: ColorScheme, level: 1 | 2 | 3) => {
  const shadowColor = palettes[scheme].shadow;
  const opacity = scheme === 'dark' ? 0.45 : 0.1;
  const config = {
    1: { radius: 16, offset: 6, elevation: 2 },
    2: { radius: 28, offset: 10, elevation: 5 },
    3: { radius: 40, offset: 16, elevation: 10 },
  }[level];

  return {
    shadowColor,
    shadowOffset: { width: 0, height: config.offset },
    shadowOpacity: opacity,
    shadowRadius: config.radius,
    elevation: config.elevation,
  };
};
