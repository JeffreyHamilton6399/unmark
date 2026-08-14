import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unmark — Find and remove hidden marks in text and files",
  description:
    "Reveal invisible characters, hidden messages and embedded metadata, then strip them out — 100% in your browser. No uploads, no sign-up, free.",
  keywords: [
    "zero-width characters",
    "invisible characters",
    "hidden text",
    "unicode cleaner",
    "metadata",
    "C2PA",
    "EXIF",
    "watermark",
    "privacy",
  ],
  authors: [{ name: "Jeffrey Hamilton" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Unmark — Find and remove hidden marks",
    description:
      "Reveal invisible characters and embedded metadata, then strip them out — right in your browser. No uploads.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Unmark — Find and remove hidden marks",
    description:
      "Reveal invisible characters and embedded metadata, then strip them out — right in your browser.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
