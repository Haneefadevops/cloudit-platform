import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes with proper precedence
 * Usage: cn("px-2 py-1", condition && "bg-primary", "text-white")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency in Sri Lankan Rupees
 * Usage: formatCurrency(1234.56) → "Rs. 1,234.56"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount).replace("LKR", "Rs.")
}

/**
 * Format time from ISO string
 * Usage: formatTime("2026-03-15T14:30:00Z") → "2:30 PM"
 */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/**
 * Format date from ISO string
 * Usage: formatDate("2026-03-15T14:30:00Z") → "Mar 15, 2026"
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Format date and time
 * Usage: formatDateTime("2026-03-15T14:30:00Z") → "Mar 15, 2026 at 2:30 PM"
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return `${formatDate(isoString)} at ${formatTime(isoString)}`
}

/**
 * Calculate hours between two timestamps
 * Usage: calculateHours("2026-03-15T09:00:00Z", "2026-03-15T17:30:00Z") → 8.5
 */
export function calculateHours(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const hours = (end - start) / (1000 * 60 * 60)
  return Math.round(hours * 100) / 100 // Round to 2 decimals
}

/**
 * Get initials from name
 * Usage: getInitials("Kasun Perera") → "KP"
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Truncate text with ellipsis
 * Usage: truncate("Long text here", 10) → "Long text..."
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}
