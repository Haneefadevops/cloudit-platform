export type Tier = 'essential' | 'premium' | 'luxe';

export interface Destination {
  id: string;
  name: string;
  tagline: string;
  image: string;
  priceFrom: number;
  basePricePerNight: number;
  duration: string;
  highlights: string[];
  itinerary: string[];
}

export const destinations: Destination[] = [
  {
    id: 'maldives',
    name: 'Maldives',
    tagline: 'Overwater villas and crystal-clear lagoons',
    image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1200&q=80',
    priceFrom: 1890,
    basePricePerNight: 378,
    duration: '5 nights',
    highlights: ['Overwater villa', 'Private dining', 'Sunset cruise', 'Spa treatment'],
    itinerary: [
      'Arrive in Malé and transfer by seaplane to your overwater villa',
      'Relax on your private deck and enjoy a welcome dinner under the stars',
      'Snorkel the house reef with a marine biologist guide',
      'Sunset dolphin cruise with champagne and canapés',
      'Spa treatment in an overwater pavilion',
      'Farewell beach barbecue before departure',
    ],
  },
  {
    id: 'santorini',
    name: 'Santorini',
    tagline: 'Sunsets, caldera views, and private terraces',
    image: 'https://images.unsplash.com/photo-1613395877344-13d4c280d288?auto=format&fit=crop&w=1200&q=80',
    priceFrom: 1450,
    basePricePerNight: 363,
    duration: '4 nights',
    highlights: ['Caldera suite', 'Wine tasting', 'Private yacht', 'Fine dining'],
    itinerary: [
      'Arrive in Santorini and settle into your caldera-view suite',
      'Private sunset wine tasting at a cliffside vineyard',
      'Morning catamaran cruise around the volcano hot springs',
      'Explore Oia with a personal photographer',
      'Farewell dinner at a Michelin-starred restaurant',
    ],
  },
  {
    id: 'swiss-alps',
    name: 'Swiss Alps',
    tagline: 'Ski chalets, spa retreats, and mountain air',
    image: 'https://images.unsplash.com/photo-1502784444187-359ac186c5bb?auto=format&fit=crop&w=1200&q=80',
    priceFrom: 1680,
    basePricePerNight: 280,
    duration: '6 nights',
    highlights: ['Luxury chalet', 'Ski pass', 'Thermal spa', 'Gourmet fondue'],
    itinerary: [
      'Arrive in Zermatt by scenic train and check into your chalet',
      'Private ski lesson on the slopes of the Matterhorn',
      'Helicopter tour over the Alps with a glacier landing',
      'Relaxing afternoon at a thermal spa',
      'Gourmet fondue experience in a mountain hut',
      'Last day of skiing and farewell fondue dinner',
    ],
  },
  {
    id: 'bali',
    name: 'Bali',
    tagline: 'Rice terraces, wellness, and tropical serenity',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
    priceFrom: 980,
    basePricePerNight: 196,
    duration: '5 nights',
    highlights: ['Pool villa', 'Yoga retreat', 'Rice terrace tour', 'Private driver'],
    itinerary: [
      'Arrive in Ubud and settle into a private pool villa',
      'Morning yoga overlooking the jungle followed by a healing session',
      'Guided walk through the Tegallalang rice terraces',
      'Private cooking class with a local chef',
      'Temple blessing ceremony with a local guide',
      'Spa day and transfer to the airport',
    ],
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    tagline: 'Temples, ryokans, and timeless tradition',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    priceFrom: 1320,
    basePricePerNight: 264,
    duration: '5 nights',
    highlights: ['Ryokan stay', 'Tea ceremony', 'Bamboo forest', 'Private guide'],
    itinerary: [
      'Arrive in Kyoto and check into a traditional ryokan',
      'Private tea ceremony in a historic machiya townhouse',
      'Morning visit to Fushimi Inari and Arashiyama bamboo grove',
      'Kaiseki dinner prepared by a master chef',
      'Kimono fitting and guided walk through Gion',
      'Farewell breakfast and departure transfer',
    ],
  },
];

export const tierMultipliers: Record<Tier, number> = {
  essential: 1.0,
  premium: 1.45,
  luxe: 2.1,
};

