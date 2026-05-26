import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/app/providers";

import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FFFFFF",
  colorScheme: "light",
};

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.falcondraft.com"),
  title: {
    default: "FalconDraft — Production commerciale augmentée",
    template: "%s — FalconDraft",
  },
  description:
    "FalconDraft prépare une base SaaS premium pour transformer un deal en proposition professionnelle, prête à valider et envoyer.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FalconDraft",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
