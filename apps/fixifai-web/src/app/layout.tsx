import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const SITE_URL = 'https://fixifai.cloudit.lk';
const TITLE = 'FixifAI — Run your maintenance business from one screen';
const DESCRIPTION =
  'QR-tagged assets, AI job intake, GPS-verified technicians — built for every maintenance trade in Sri Lanka. Join the free 3-month pilot.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | FixifAI',
  },
  description: DESCRIPTION,
  applicationName: 'FixifAI',
  creator: 'CloudIT',
  publisher: 'CloudIT',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'FixifAI',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="bg-white font-sans antialiased">{children}</body>
    </html>
  );
}
