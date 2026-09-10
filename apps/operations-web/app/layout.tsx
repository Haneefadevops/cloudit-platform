import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CloudIT Operations", template: "%s — CloudIT Operations" },
  description: "Private CloudIT operational evidence portal",
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
