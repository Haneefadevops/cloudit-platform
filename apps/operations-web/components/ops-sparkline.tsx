export function Sparkline({ points, labelledBy }: { points: Array<{ value: number | null; ok: boolean | null }>; labelledBy?: string }) {
  const width = 240;
  const height = 52;
  const pad = 5;
  const numeric = points.filter((point) => point.value !== null);
  if (numeric.length < 2) {
    return <p className="ops-empty-note">No trend data (NO DATA).</p>;
  }
  const values = numeric.map((point) => point.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(1, points.length - 1);
  const xOf = (index: number) => pad + index * stepX;
  const yOf = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  let line = "";
  points.forEach((point, index) => {
    if (point.value === null) return;
    line += `${line ? "L" : "M"}${xOf(index).toFixed(1)},${yOf(point.value).toFixed(1)} `;
  });
  return <svg className="ops-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={labelledBy}>
    <path className="spark-line" d={line.trim()} fill="none" strokeWidth="1.5" />
    {points.map((point, index) => point.ok === null ? null : (
      <circle key={index} className={point.ok ? "spark-up" : "spark-down"} cx={xOf(index).toFixed(1)} cy={point.value === null ? height - pad : yOf(point.value).toFixed(1)} r="2" />
    ))}
  </svg>;
}
