export interface CsvColumn {
  key: string
  label: string
}

export function toCSV(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const escape = (val: unknown): string => {
    const s = val == null ? '' : String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = columns.map(c => c.label).join(',')
  const body   = rows.map(row => columns.map(c => escape(row[c.key])).join(','))
  return [header, ...body].join('\n')
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
