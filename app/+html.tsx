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
        <meta name="theme-color" content="#2563EB" />
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
  body { overflow-x: hidden; overscroll-behavior-y: none; background: #f9fafb; }
  * { box-sizing: border-box; }
  button, [role='button'] { touch-action: manipulation; }
  input, textarea, select { font-size: 16px !important; }
  @supports (padding: env(safe-area-inset-top)) {
    body { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
  }
`;
