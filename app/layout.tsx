import React from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { Instrument_Serif, JetBrains_Mono, Inter_Tight } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TierProvider } from "@/components/pro-gate";
import { MarckoFeedback } from "@/components/marcko-feedback";
import { getSiteOrigin } from "@/lib/site-url";
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
  metadataBase: new URL(getSiteOrigin()),
  applicationName: "Marcko",
  category: "productivity",
  title: {
    default:
      "Marcko V2 - Markdown Editor with MCP Publishing and Feedback Widgets",
    template: "%s | Marcko",
  },
  description:
    "Marcko V2 is an open source markdown editor with real-time preview, secure document sharing, MCP publishing for AI clients, and embeddable feedback widgets.",
  keywords: [
    "markdown editor",
    "markdown preview",
    "MCP markdown editor",
    "MCP server",
    "AI document publishing",
    "feedback widget",
    "feedback collector",
    "secure document sharing",
    "markdown",
    "open source",
    "writing",
    "documentation",
    "marcko",
  ],
  authors: [{ name: "Marcko Team" }],
  creator: "Marcko",
  publisher: "Marcko",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Marcko",
    title: "Marcko V2 - Markdown Editor with MCP Publishing and Feedback Widgets",
    description:
      "Open source markdown editor with real-time preview, secure sharing, MCP publishing for AI clients, and embeddable feedback collection.",
    images: [
      {
        url: "/og.png",
        width: 1784,
        height: 882,
        alt: "Marcko V2 markdown editor with secure sharing, MCP publishing, and feedback widgets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marcko V2 - Markdown Editor with MCP Publishing",
    description:
      "Open source markdown editor with secure sharing, MCP publishing for AI clients, and feedback widgets.",
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
  const origin = getSiteOrigin();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: "Marcko",
        description:
          "Open source markdown editor with secure sharing, MCP publishing, and embeddable feedback widgets.",
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#software`,
        name: "Marcko",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        url: origin,
        image: `${origin}/og.png`,
        description:
          "Marcko V2 helps developers and writers draft markdown, publish from MCP-compatible AI clients, securely share documents, and collect product feedback.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Real-time markdown preview",
          "Secure document sharing",
          "MCP publishing from AI clients",
          "Embeddable feedback widgets",
          "GitHub Flavored Markdown",
          "Math and Mermaid rendering",
        ],
      },
    ],
  };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable} ${interTight.variable}`}
    >
      <body className={`font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TierProvider>
            {children}
            <Toaster richColors position="top-right" />
            <MarckoFeedback />
          </TierProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
