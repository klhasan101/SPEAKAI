import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-neutral-950 flex flex-col items-center justify-start">
        <Providers>
          {/* Strict Layout Boundary: Mobile Container Wrapper */}
          <div className="w-full max-w-md min-h-screen bg-background border-x border-border shadow-2xl flex flex-col relative">
            <main className="flex-1 flex flex-col overflow-y-auto pb-6">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
