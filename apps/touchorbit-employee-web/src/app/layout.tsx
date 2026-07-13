import type { Metadata } from "next";
import { Providers } from "./providers";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { UnregisterServiceWorkers } from "@/components/unregister-service-workers";
import "./globals.css";

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
      <body suppressHydrationWarning>
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
