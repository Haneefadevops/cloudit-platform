/**
 * Deterministic pseudo-QR pattern derived from the code string —
 * decorative only, looks like a QR badge at a glance.
 */
export default function QRBadge({ code, size = 72 }: { code: string; size?: number }) {
  const cells = 9;
  // simple deterministic hash per cell from the code string
  const filled: boolean[] = [];
  for (let i = 0; i < cells * cells; i++) {
    const ch = code.charCodeAt(i % code.length);
    filled.push(((ch * (i + 7) + i * i) % 5) < 2);
  }
  // corner finder squares always drawn
  const isFinder = (r: number, c: number) =>
    (r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3);

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div
        className="grid gap-px rounded-md bg-white p-1.5 ring-1 ring-gray-200"
        style={{ gridTemplateColumns: `repeat(${cells}, 1fr)`, width: size, height: size }}
        aria-label={`QR code ${code}`}
      >
        {Array.from({ length: cells * cells }).map((_, i) => {
          const r = Math.floor(i / cells);
          const c = i % cells;
          const on = isFinder(r, c) ? true : filled[i];
          return <span key={i} className={on ? 'bg-brand-dark' : 'bg-white'} />;
        })}
      </div>
      <span className="font-mono text-[10px] font-semibold tracking-wide text-gray-500">{code}</span>
    </div>
  );
}
