import { AssetHistoryEntry } from './demo-data';

/** Vertical service-history timeline — shared by the portal, dashboard and technician app. */
export default function AssetTimeline({
  history,
  compact = false,
}: {
  history: AssetHistoryEntry[];
  compact?: boolean;
}) {
  return (
    <ol className={`relative border-l-2 border-brand-teal/20 ${compact ? 'space-y-2.5 pl-3.5' : 'space-y-3 pl-4'}`}>
      {history.map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand-teal ring-2 ring-white" />
          <p className="text-[10px] font-semibold text-gray-400">{h.date}</p>
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold text-brand-dark`}>{h.type}</p>
          <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} leading-snug text-gray-600`}>{h.note}</p>
          <p className="text-[10px] text-gray-400">by {h.technician}</p>
        </li>
      ))}
    </ol>
  );
}
