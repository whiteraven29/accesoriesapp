import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#5F33E1" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveWebStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveWebStyles = `
  html, body, #root { width: 100%; min-height: 100%; margin: 0; }
  #root { min-height: 100vh; min-height: 100dvh; }
  /* Painted before React mounts, so the first frame matches the theme the
     user will land on instead of flashing white on a dark device. */
  body { overflow-x: hidden; overscroll-behavior-y: none; background: #F2F0FD; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { body { background: #110E1D; } }
  * { box-sizing: border-box; }
  button, [role='button'] { touch-action: manipulation; }
  /* 16px stops iOS Safari zooming the viewport on focus at the till. */
  input, textarea, select { font-size: 16px !important; }
  /* Respect a shopkeeper who has reduced motion enabled system-wide. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  @supports (padding: env(safe-area-inset-top)) {
    body { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
  }
`;
