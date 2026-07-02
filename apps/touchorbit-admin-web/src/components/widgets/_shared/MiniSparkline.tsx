interface MiniSparklineProps {
  data: number[]
  color: string
  width?: number
  height?: number
}

export function MiniSparkline({ data, color, width = 64, height = 24 }: MiniSparklineProps) {
  if (!data.length || data.every(v => v === 0)) return null
  const max = Math.max(...data, 1)
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`)
    .join(' ')
  return (
    <svg width={width} height={height}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  )
}
