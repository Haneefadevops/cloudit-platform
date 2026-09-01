import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const SITE_URL = 'https://wanderluxe.cloudit.lk';
const TITLE = 'WanderLuxe — Curated Journeys, Effortless Memories';
const DESCRIPTION =
  'Bespoke luxury travel packages crafted by experts. Explore curated destinations, customize your trip, and travel effortlessly with 24/7 concierge support.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | WanderLuxe',
  },
  description: DESCRIPTION,
  keywords: [
    'luxury travel',
    'curated journeys',
    'bespoke travel',
    'luxury vacation packages',
    'travel concierge',
    'WanderLuxe',
  ],
  applicationName: 'WanderLuxe',
  creator: 'CloudIT',
  publisher: 'CloudIT',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'WanderLuxe',
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
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1120',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-sand-50 font-sans text-navy-900 antialiased">
        {children}
      </body>
    </html>
  );
}
