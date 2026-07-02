import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { UnregisterServiceWorkers } from "@/components/unregister-service-workers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["300","400","500","600","700","800"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "TouchOrbit Employee",
  description: "Clock in, manage leave, and view your attendance - TouchOrbit Employee App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={plusJakartaSans.variable} suppressHydrationWarning>
        <Providers>
          <UnregisterServiceWorkers />
          <div>
            {children}
          </div>
          <OfflineSyncStatus />
        </Providers>
      </body>
    </html>
  );
}
