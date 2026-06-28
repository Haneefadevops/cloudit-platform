import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "CloudIT Platform", template: "%s — CloudIT Platform" },
  description: "Multi-tenant SaaS platform by CloudIT Solutions (Pvt) Ltd",
  keywords: ["CloudIT", "SaaS", "platform", "hospitality", "automation"],
  authors: [{ name: "CloudIT Solutions" }],
  openGraph: {
    title: "CloudIT Platform",
    description: "Multi-tenant SaaS platform by CloudIT Solutions (Pvt) Ltd",
    type: "website",
    locale: "en_LK",
    siteName: "CloudIT Platform",
  },
  twitter: {
    card: "summary_large_image",
    title: "CloudIT Platform",
    description: "Multi-tenant SaaS platform by CloudIT Solutions (Pvt) Ltd",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
