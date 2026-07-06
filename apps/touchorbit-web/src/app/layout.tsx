import type { Metadata } from "next";
import "@cloudit/ui/globals.css";
import { ToastProvider } from "@cloudit/ui";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "CloudIT TouchOrbit HR", template: "%s — CloudIT TouchOrbit HR" },
  description: "HR management by CloudIT Solutions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
