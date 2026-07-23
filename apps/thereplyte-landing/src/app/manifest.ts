import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TheReplyte — AI Employee for WhatsApp',
    short_name: 'TheReplyte',
    description:
      'Hire an AI employee for your WhatsApp. Instant multilingual replies, orders, bookings and smart human handoff — 24/7.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4a42fc',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  };
}
