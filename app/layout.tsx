import React from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { Instrument_Serif, JetBrains_Mono, Inter_Tight } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-editor",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://marcko.bixai.dev"),
  title: {
    default:
      "Marcko - Open Source Markdown Editor with Secure Document Sharing",
    template: "%s | Marcko",
  },
  description:
    "Open source markdown editor with real-time preview, secure document sharing, encryption at rest, and AI integration. Free for developers and writers.",
  keywords: [
    "markdown editor",
    "markdown preview",
    "secure document sharing",
    "markdown",
    "open source",
    "writing",
    "documentation",
    "marcko",
  ],
  authors: [{ name: "Marcko Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://marcko.bixai.dev",
    siteName: "Marcko",
    title: "Marcko - Open Source Markdown Editor with Secure Document Sharing",
    description:
      "Open source markdown editor with real-time preview, secure document sharing, encryption at rest, and AI integration.",
    images: [
      {
        url: "/og.png",
        width: 1784,
        height: 882,
        alt: "Marcko - Open Source Markdown Editor with Enterprise Secure Sharing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marcko - Open Source Markdown Editor with Secure Document Sharing",
    description:
      "Open source markdown editor with real-time preview, secure document sharing, and AI integration.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable} ${interTight.variable}`}
    >
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
