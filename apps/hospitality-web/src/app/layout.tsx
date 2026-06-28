import type { Metadata } from "next";
import "@cloudit/ui/globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "CloudIT Hospitality", template: "%s — CloudIT Hospitality" },
  description: "Hospitality OS by CloudIT Solutions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
