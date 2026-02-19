/**
 * Tarih/saat yardımcı fonksiyonları — tüm gösterimler İstanbul (UTC+3) saatine göre.
 */

const TZ = 'Europe/Istanbul'

/** ISO string veya Date → "15.01.2024 14:30:45" */
export function fmtDateTime(value?: string | Date | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('tr-TR', { timeZone: TZ })
  } catch {
    return String(value)
  }
}

/** ISO string veya Date → "14:30:45" */
export function fmtTime(value?: string | Date | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleTimeString('tr-TR', { timeZone: TZ })
  } catch {
    return String(value)
  }
}

/** ISO string veya Date → "15.01.2024" */
export function fmtDate(value?: string | Date | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('tr-TR', { timeZone: TZ })
  } catch {
    return String(value)
  }
}

/**
 * İki tarih arasındaki süreyi insan okunabilir stringe çevirir.
 * Örn: "2dk 34sn" | "1sa 5dk" | "3sn"
 */
export function fmtDuration(start?: string | Date | null, end?: string | Date | null): string {
  if (!start || !end) return '—'
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (ms < 0) return '—'
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}sa ${m}dk`
    if (m > 0) return `${m}dk ${s}sn`
    return `${s}sn`
  } catch {
    return '—'
  }
}

/** Milisaniyeden süre string'i */
export function fmtDurationMs(ms: number): string {
  if (ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}sa ${m}dk`
  if (m > 0) return `${m}dk ${s}sn`
  return `${s}sn`
}
