import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = 'https://thereplyte.com';
const TITLE = 'TheReplyte — AI Employee for WhatsApp | 24/7 Multilingual Replies';
const DESCRIPTION =
  'Hire an AI employee for your WhatsApp. Answers customers instantly in their language, takes orders and bookings, and hands off to your team when it matters — 24/7.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | TheReplyte',
  },
  description: DESCRIPTION,
  keywords: [
    'WhatsApp AI',
    'AI chatbot for WhatsApp',
    'WhatsApp automation',
    'AI customer support',
    'multilingual chatbot',
    'WhatsApp booking bot',
    'WhatsApp order taking',
    'AI employee',
    'business WhatsApp assistant',
    'TheReplyte',
  ],
  applicationName: 'TheReplyte',
  creator: 'CloudIT',
  publisher: 'CloudIT',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'TheReplyte',
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
  themeColor: '#ffffff',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'TheReplyte',
      url: SITE_URL,
      logo: `${SITE_URL}/logo-mark.webp`,
      email: 'hello@thereplyte.com',
      parentOrganization: {
        '@type': 'Organization',
        name: 'CloudIT',
        url: 'https://www.cloudit.lk',
      },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'TheReplyte',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: DESCRIPTION,
      offers: [
        {
          '@type': 'Offer',
          name: 'Starter',
          price: '12',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Business',
          price: '25',
          priceCurrency: 'USD',
        },
      ],
    },
    {
      '@type': 'LocalBusiness',
      name: 'TheReplyte by CloudIT',
      url: SITE_URL,
      email: 'hello@thereplyte.com',
      telephone: '+94771696631',
      priceRange: '$12 - $25',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'LK',
      },
      parentOrganization: {
        '@type': 'Organization',
        name: 'CloudIT',
        url: 'https://www.cloudit.lk',
      },
      sameAs: ['https://www.cloudit.lk'],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white font-sans text-[#12142b] antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-YGVG7Y3HNE"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YGVG7Y3HNE');
          `}
        </Script>
      </body>
    </html>
  );
}
