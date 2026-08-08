const trades = [
  'AC',
  'Lifts',
  'Generators',
  'Fire & Security',
  'Facilities',
  'CCTV',
  'Elevators',
  'Refrigeration',
  'Plumbing',
  'Solar',
];

export default function Marquee() {
  // content rendered twice; the track slides -50% for a seamless loop
  const row = [...trades, ...trades];
  return (
    <div className="overflow-hidden border-t border-white/10 bg-black/20 py-4">
      <div className="animate-marquee flex w-max items-center">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center" aria-hidden={half === 1}>
            {row.map((t, i) => (
              <span
                key={`${half}-${i}`}
                className="flex items-center whitespace-nowrap text-sm font-medium tracking-wide text-white/60"
              >
                <span className="px-5">{t}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-orange/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
