import React from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import "./globals.css";

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
        width: 1200,
        height: 630,
        alt: "Marcko - Open Source Markdown Editor with Enterprise Secure Sharing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marcko - Open Source Markdown Editor with Secure Document Sharing",
    description:
      "Open source markdown editor with real-time preview, secure document sharing, and AI integration.",
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
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
        <Analytics />
      </body>
    </html>
  );
}
