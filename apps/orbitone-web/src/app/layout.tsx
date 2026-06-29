import type { Metadata } from "next";
import "@cloudit/ui/globals.css";

export const metadata: Metadata = {
  title: { default: "CloudIT OrbitOne", template: "%s — CloudIT OrbitOne" },
  description: "Digital business cards by CloudIT Solutions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
