import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ShadowSpeak AI",
  description: "Master spoken American English using the shadowing technique, backed by Gemini 3.5 Flash.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShadowSpeak",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-[100dvh] overflow-hidden antialiased" suppressHydrationWarning>
      <body className="h-[100dvh] w-full bg-neutral-950 flex flex-col items-center justify-center overflow-hidden p-3">
        <Providers>
          {/* Strict Layout Boundary: Mobile Container Wrapper */}
          <div className="w-full max-w-md h-full bg-background border border-border rounded-[24px] shadow-2xl flex flex-col relative overflow-hidden">
            <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
