const sriLankaNumberFormat = new Intl.NumberFormat("en-LK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sriLankaDateFormat = new Intl.DateTimeFormat("en-LK", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

export function formatLkr(value?: number | string | null) {
  const amount = Number(value ?? 0);
  return `Rs. ${sriLankaNumberFormat.format(Number.isFinite(amount) ? amount : 0)}`;
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return sriLankaDateFormat.format(date);
}

export function formatMonthYear(value: Date) {
  return new Intl.DateTimeFormat("en-LK", {
    month: "long",
    year: "numeric",
  }).format(value);
}
