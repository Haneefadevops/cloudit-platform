import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TheReplyte — AI Agent for WhatsApp',
  description:
    'Hire an AI employee for your WhatsApp. Answers customers instantly in their language, takes orders and bookings, and hands off to your team when it matters — 24/7.',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white font-sans text-[#12142b] antialiased">{children}</body>
    </html>
  );
}
