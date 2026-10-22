import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html, body, #root { height: 100%; width: 100%; background: #070a07; } body { margin: 0; } #root { display: flex; justify-content: center; }",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
