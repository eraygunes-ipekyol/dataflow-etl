import { useState, useMemo, useCallback, useEffect } from 'react'
import { Clock, Calendar, Info, AlertTriangle } from 'lucide-react'
import cronstrue from 'cronstrue/i18n'

// ─── Şablonlar ──────────────────────────────────────────────────────────────

const QUICK_PRESETS = [
  { label: 'Her 5dk', value: '*/5 * * * *' },
  { label: 'Her 10dk', value: '*/10 * * * *' },
  { label: 'Her 15dk', value: '*/15 * * * *' },
  { label: 'Her 30dk', value: '*/30 * * * *' },
  { label: 'Her 1 saat', value: '0 * * * *' },
]

// ─── Gün tanımları ──────────────────────────────────────────────────────────

const DAYS = [
  { label: 'Pzt', short: 'P', cron: '1' },
  { label: 'Sal', short: 'S', cron: '2' },
  { label: 'Çar', short: 'Ç', cron: '3' },
  { label: 'Per', short: 'P', cron: '4' },
  { label: 'Cum', short: 'C', cron: '5' },
  { label: 'Cmt', short: 'C', cron: '6' },
  { label: 'Paz', short: 'P', cron: '0' },
] as const

// ─── Yardımcı fonksiyonlar ──────────────────────────────────────────────────

/** Cron'un 5 parçasını parse et */
function parseCron(cron: string): string[] {
  const parts = cron.trim().split(/\s+/)
  if (parts.length === 5) return parts
  return ['*', '*', '*', '*', '*']
}

/** Cron'un gün-of-week alanından seçili günleri çıkar */
function parseDaysFromCron(dow: string): Set<string> {
  if (dow === '*') return new Set()
  const days = new Set<string>()

  // Virgülle ayrılmış parçaları işle
  for (const part of dow.split(',')) {
    const trimmed = part.trim()
    // Aralık: 1-5
    const rangeMatch = trimmed.match(/^(\d)-(\d)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1])
      const end = parseInt(rangeMatch[2])
      for (let i = start; i <= end; i++) {
        days.add(String(i))
      }
    } else if (/^\d$/.test(trimmed)) {
      days.add(trimmed)
    }
  }
  return days
}

/** Seçili gün set'inden cron day-of-week alanı üret */
function daysToCron(days: Set<string>): string {
  if (days.size === 0 || days.size === 7) return '*'

  // Haftaiçi kısayolu
  const weekdaySet = new Set(['1', '2', '3', '4', '5'])
  const weekendSet = new Set(['0', '6'])

  if (days.size === 5 && [...weekdaySet].every((d) => days.has(d))) return '1-5'
  if (days.size === 2 && [...weekendSet].every((d) => days.has(d))) return '0,6'

  // Sayısal sıralama
  const sorted = [...days].map(Number).sort((a, b) => a - b)

  // Ardışık aralık kontrolü
  if (sorted.length >= 2) {
    let isConsecutive = true
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        isConsecutive = false
        break
      }
    }
    if (isConsecutive) return `${sorted[0]}-${sorted[sorted.length - 1]}`
  }

  return sorted.join(',')
}

// Cron ifadesinin dakika bazli olup olmadigini kontrol et
function isIntervalBased(cron: string): boolean {
  const parts = parseCron(cron)
  const minute = parts[0]
  const hour = parts[1]
  // */5, */10, vb. veya * * * * *
  return (minute.startsWith('*/') || minute === '*') && (hour === '*' || hour.startsWith('*/'))
}

/** cronstrue ile Türkçe açıklama al */
function getCronDescription(cron: string): { text: string; valid: boolean } {
  if (!cron.trim()) return { text: '', valid: false }
  try {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) return { text: 'Cron ifadesi 5 alandan oluşmalıdır', valid: false }
    const desc = cronstrue.toString(cron, { locale: 'tr', use24HourTimeFormat: true })
    return { text: desc, valid: true }
  } catch {
    return { text: 'Geçersiz cron ifadesi', valid: false }
  }
}

// ─── Ana Bileşen ────────────────────────────────────────────────────────────

interface CronBuilderProps {
  value: string
  onChange: (cron: string) => void
}

export default function CronBuilder({ value, onChange }: CronBuilderProps) {
  const parts = useMemo(() => parseCron(value), [value])
  const intervalMode = useMemo(() => isIntervalBased(value), [value])

  // Seçili günler
  const selectedDays = useMemo(() => parseDaysFromCron(parts[4]), [parts])

  // Saat/dakika (sadece belirli saat modunda anlamlı)
  const [hour, setHour] = useState(() => {
    const h = parts[1]
    return h !== '*' && !h.startsWith('*/') ? h : '8'
  })
  const [minute, setMinute] = useState(() => {
    const m = parts[0]
    return m !== '*' && !m.startsWith('*/') ? m : '0'
  })

  // Cron değişince saat/dakika senkronize
  useEffect(() => {
    const p = parseCron(value)
    if (p[1] !== '*' && !p[1].startsWith('*/')) setHour(p[1])
    if (p[0] !== '*' && !p[0].startsWith('*/')) setMinute(p[0])
  }, [value])

  const description = useMemo(() => getCronDescription(value), [value])

  // ── Şablon tıklama ──
  const handlePreset = useCallback((preset: string) => {
    onChange(preset)
  }, [onChange])

  // ── Gün toggle ──
  const handleDayToggle = useCallback((cronDay: string) => {
    const p = parseCron(value)
    const days = parseDaysFromCron(p[4])

    if (days.has(cronDay)) days.delete(cronDay)
    else days.add(cronDay)

    const newDow = daysToCron(days)
    // Gün seçildiğinde interval modundan çık — belirli saat moduna geç
    const m = p[0].startsWith('*/') || p[0] === '*' ? minute : p[0]
    const h = p[1].startsWith('*/') || p[1] === '*' ? hour : p[1]
    onChange(`${m} ${h} ${p[2]} ${p[3]} ${newDow}`)
  }, [value, hour, minute, onChange])

  // ── Gün kısayolları ──
  const handleDayShortcut = useCallback((type: 'weekdays' | 'weekend' | 'everyday') => {
    const p = parseCron(value)
    const m = p[0].startsWith('*/') || p[0] === '*' ? minute : p[0]
    const h = p[1].startsWith('*/') || p[1] === '*' ? hour : p[1]

    let dow: string
    switch (type) {
      case 'weekdays': dow = '1-5'; break
      case 'weekend': dow = '0,6'; break
      case 'everyday': dow = '*'; break
    }
    onChange(`${m} ${h} ${p[2]} ${p[3]} ${dow}`)
  }, [value, hour, minute, onChange])

  // ── Saat/dakika değişimi ──
  const handleTimeChange = useCallback((newHour: string, newMinute: string) => {
    setHour(newHour)
    setMinute(newMinute)
    const p = parseCron(value)
    onChange(`${newMinute} ${newHour} ${p[2]} ${p[3]} ${p[4]}`)
  }, [value, onChange])

  // Aktif preset kontrolü
  const activePreset = QUICK_PRESETS.find((p) => p.value === value.trim())

  return (
    <div className="space-y-3">
      {/* Label */}
      <label className="block text-sm font-medium">Cron Zamanlaması *</label>

      {/* Hızlı Şablonlar */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Hızlı seçim</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePreset(preset.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activePreset?.value === preset.value
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manuel Cron Input */}
      <div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="*/5 * * * *"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Otomatik Açıklama */}
        {value.trim() && (
          <div className={`flex items-start gap-1.5 mt-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
            description.valid
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {description.valid
              ? <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              : <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            }
            <span>{description.text}</span>
          </div>
        )}
      </div>

      {/* Haftanın Günleri */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Haftanın günleri</p>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          {DAYS.map((day) => {
            const isSelected = selectedDays.has(day.cron)
            return (
              <button
                key={day.cron + day.label}
                type="button"
                onClick={() => handleDayToggle(day.cron)}
                className={`w-9 h-8 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
                title={day.label}
              >
                {day.label}
              </button>
            )
          })}
        </div>

        {/* Gün kısayolları */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => handleDayShortcut('weekdays')}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              parts[4] === '1-5'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Haftaiçi
          </button>
          <button
            type="button"
            onClick={() => handleDayShortcut('weekend')}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              parts[4] === '0,6'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Haftasonu
          </button>
          <button
            type="button"
            onClick={() => handleDayShortcut('everyday')}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              parts[4] === '*' && !intervalMode
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Her gün
          </button>
        </div>
      </div>

      {/* Saat Seçimi */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Çalışma saati</p>
        <div className="flex items-center gap-2">
          <select
            value={hour}
            onChange={(e) => handleTimeChange(e.target.value, minute)}
            disabled={intervalMode}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={String(i)}>
                {String(i).padStart(2, '0')}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground font-bold">:</span>
          <select
            value={minute}
            onChange={(e) => handleTimeChange(hour, e.target.value)}
            disabled={intervalMode}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
              <option key={m} value={String(m)}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
          {intervalMode && (
            <span className="text-[10px] text-muted-foreground ml-1">
              (aralık modunda saat seçimi devre dışı)
            </span>
          )}
        </div>
      </div>

      {/* Format bilgisi */}
      <p className="text-[10px] text-muted-foreground/60">
        Format: dakika saat gün ay haftanın-günü — İstanbul saatine göre (UTC+3)
      </p>
    </div>
  )
}
