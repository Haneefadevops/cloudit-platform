import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import { SessionGuard } from "@/components/session-guard";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["300","400","500","600","700","800"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "TouchOrbit Admin Dashboard",
  description: "Manage employees, attendance, and HR operations - TouchOrbit Admin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={plusJakartaSans.variable}>
        <Providers>
          <SessionGuard>
            {children}
          </SessionGuard>
        </Providers>
      </body>
    </html>
  );
}
