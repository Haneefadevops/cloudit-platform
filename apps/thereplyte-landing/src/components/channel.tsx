export type Channel = 'whatsapp' | 'messenger' | 'instagram';

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

/** Header bar background per channel (solid color or gradient). */
export const CHANNEL_HEADER: Record<Channel, string> = {
  whatsapp: '#008069',
  messenger: 'linear-gradient(90deg,#0084ff,#00c6ff)',
  instagram: 'linear-gradient(90deg,#833AB4,#FD1D1D,#F77737)',
};

/** Outgoing (customer) bubble classes per channel. */
export const CHANNEL_OUTGOING_BUBBLE: Record<Channel, string> = {
  whatsapp: 'bg-[#d9fdd3] text-[#111b21]',
  messenger: 'bg-[#0084ff] text-white',
  instagram: 'bg-[#e9e9f2] text-[#111b21]',
};

export function ChannelIcon({
  channel,
  size = 11,
}: {
  channel: Channel;
  size?: number;
}) {
  if (channel === 'messenger')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.2 1.9.3 2.9.3 5.5 0 10-4.1 10-9.2S17.5 2 12 2Zm1 12.4-2.5-2.6-4.8 2.6 5.3-5.6 2.5 2.6 4.8-2.6-5.3 5.6Z" />
      </svg>
    );
  if (channel === 'instagram')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.23.65-1.35 1.24-1.87 1.28-.5.05-.97.23-3.28-.68-2.77-1.1-4.53-3.9-4.67-4.08-.14-.18-1.12-1.5-1.12-2.85s.71-2.02.96-2.3c.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.23.55.78 1.9.85 2.04.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.57.16.28.7 1.16 1.5 1.88 1.04.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.8.86-1.07.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.27.14.45.2.52.32.07.11.07.66-.16 1.3Z" />
    </svg>
  );
}
