import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const sans = Inter_Tight({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unmark: find hidden characters and metadata",
  description:
    "Zero-width characters, odd Unicode lookalikes, EXIF, C2PA. Unmark shows what is sitting in a piece of text or a file, and takes it out if you want it gone.",
  authors: [{ name: "Jeffrey Hamilton" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Unmark",
    description:
      "See the invisible characters and metadata in text and files, then strip them.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Unmark",
    description:
      "See the invisible characters and metadata in text and files.",
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
        className={`${sans.variable} ${mono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
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
