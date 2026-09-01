import { destinations, tierMultipliers, type Destination, type Tier } from './data';

export interface QuoteInputs {
  destinationId: string;
  tier: Tier;
  travelers: number;
  nights: number;
}

const CONCIERGE_FEE_LUXE = 800;

export function getDestinationById(id: string): Destination | undefined {
  return destinations.find((d) => d.id === id);
}

export function calculateTotal({ destinationId, tier, travelers, nights }: QuoteInputs): number {
  const destination = getDestinationById(destinationId);
  if (!destination) return 0;

  const base = destination.basePricePerNight * nights * travelers * tierMultipliers[tier];
  const concierge = tier === 'luxe' ? CONCIERGE_FEE_LUXE : 0;
  return Math.round(base + concierge);
}

export function formatPrice(value: number): string {
  return `$${value.toLocaleString()}`;
}
