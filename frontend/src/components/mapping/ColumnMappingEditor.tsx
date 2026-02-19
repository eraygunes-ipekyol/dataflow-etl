import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronRight, Trash2, Plus, Loader2, Wand2 } from 'lucide-react'
import type { ColumnMapping, DataType } from '@/types/workflow'
import TransformEditor from './TransformEditor'

interface SourceColumn {
  name: string
  type: string
}

const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: 'string', label: 'Metin' },
  { value: 'integer', label: 'Tam Sayı' },
  { value: 'float', label: 'Ondalık' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Tarih' },
  { value: 'datetime', label: 'Tarih & Saat' },
  { value: 'timestamp', label: 'Timestamp' },
]

/** Veri tipi rengini belirle */
function typeColor(type: string): string {
  const t = type.toLowerCase()
  if (['int', 'integer', 'bigint', 'smallint', 'tinyint', 'float', 'decimal', 'numeric', 'real', 'money', 'smallmoney'].some((x) => t.includes(x)))
    return 'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-800/40'
  if (['date', 'time', 'datetime', 'timestamp'].some((x) => t.includes(x)))
    return 'text-purple-700 bg-purple-100 border-purple-300 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-800/40'
  if (['char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext', 'string'].some((x) => t.includes(x)))
    return 'text-green-700 bg-green-100 border-green-300 dark:text-green-400 dark:bg-green-950/40 dark:border-green-800/40'
  if (['bit', 'bool'].some((x) => t.includes(x)))
    return 'text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-400 dark:bg-orange-950/40 dark:border-orange-800/40'
  return 'text-muted-foreground bg-muted/30 border-border'
}

/** Küçük tip badge */
function TypeBadge({ type }: { type: string }) {
  if (!type) return null
  return (
    <span className={`inline-block mt-0.5 px-1 py-0 rounded border text-[10px] leading-4 font-mono truncate max-w-full ${typeColor(type)}`}>
      {type}
    </span>
  )
}

interface Props {
  sourceColumns: SourceColumn[]
  dstColumns?: SourceColumn[]          // Hedef tablo kolonları (tip gösterimi için)
  mappings: ColumnMapping[]
  onChange: (mappings: ColumnMapping[]) => void
  isLoading?: boolean
  onAutoMap?: () => void
}

export default function ColumnMappingEditor({
  sourceColumns,
  dstColumns = [],
  mappings,
  onChange,
  isLoading = false,
  onAutoMap,
}: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [allSelected, setAllSelected] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  // Hedef kolon tipini adından bul
  const getDstType = (colName: string): string => {
    return dstColumns.find((c) => c.name.toLowerCase() === colName.toLowerCase())?.type ?? ''
  }

  // Tüm satır seçimi
  const handleSelectAll = (checked: boolean) => {
    setAllSelected(checked)
    if (checked) {
      setSelectedRows(new Set(mappings.map((_, i) => i)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleRowSelect = (index: number, checked: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      checked ? next.add(index) : next.delete(index)
      setAllSelected(next.size === mappings.length && mappings.length > 0)
      return next
    })
  }

  // Seçili satırları sil
  const deleteSelected = () => {
    onChange(mappings.filter((_, i) => !selectedRows.has(i)))
    setSelectedRows(new Set())
    setAllSelected(false)
  }

  const toggleExpand = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  const updateMapping = (index: number, update: Partial<ColumnMapping>) => {
    onChange(mappings.map((m, i) => (i === index ? { ...m, ...update } : m)))
  }

  const removeMapping = (index: number) => {
    onChange(mappings.filter((_, i) => i !== index))
    setSelectedRows((prev) => {
      const next = new Set<number>()
      prev.forEach((r) => { if (r < index) next.add(r); else if (r > index) next.add(r - 1) })
      return next
    })
  }

  // Boş bir satır ekle
  const addMapping = () => {
    const usedSources = new Set(mappings.map((m) => m.source_column))
    const available = sourceColumns.find((sc) => !usedSources.has(sc.name))
    const newMapping: ColumnMapping = {
      source_column: available?.name || '',
      target_column: available?.name || '',
      transforms: [],
      skip: false,
    }
    onChange([...mappings, newMapping])
  }

  // Tüm source kolonları eşle (aynı isim → aynı hedef)
  const autoMap = () => {
    const mapped: ColumnMapping[] = sourceColumns.map((sc) => ({
      source_column: sc.name,
      target_column: sc.name,
      transforms: [],
      skip: false,
    }))
    onChange(mapped)
    setSelectedRows(new Set())
    setAllSelected(false)
  }

  // Seçili satırların "skip" değerini toggle et
  const skipSelected = (skip: boolean) => {
    onChange(mappings.map((m, i) => (selectedRows.has(i) ? { ...m, skip } : m)))
  }

  // Seçili/tüm satırları belirli bir cast tipine ayarla
  const castSelected = (castTo: DataType) => {
    const indicesToUpdate = selectedRows.size > 0 ? selectedRows : new Set(mappings.map((_, i) => i))
    onChange(
      mappings.map((m, i) => {
        if (!indicesToUpdate.has(i)) return m
        const existingTransforms = (m.transforms || []).filter((t) => t.type !== 'cast')
        return { ...m, transforms: [...existingTransforms, { type: 'cast', cast_to: castTo }] }
      })
    )
  }

  // Cast tipini al (varsa)
  const getCastType = (mapping: ColumnMapping): DataType | '' => {
    const castTransform = (mapping.transforms || []).find((t) => t.type === 'cast')
    return (castTransform?.cast_to as DataType) || ''
  }

  // Default değeri al (varsa)
  const getDefaultValue = (mapping: ColumnMapping): string => {
    const defaultTransform = (mapping.transforms || []).find((t) => t.type === 'default')
    return defaultTransform?.default_value || ''
  }

  // Cast tipini güncelle (transforms listesi içinde)
  const updateCastType = (index: number, castTo: DataType | '') => {
    const m = mappings[index]
    let transforms = (m.transforms || []).filter((t) => t.type !== 'cast')
    if (castTo) transforms = [...transforms, { type: 'cast', cast_to: castTo }]
    updateMapping(index, { transforms })
  }

  // Default değeri güncelle (transforms listesi içinde)
  const updateDefaultValue = (index: number, value: string) => {
    const m = mappings[index]
    let transforms = (m.transforms || []).filter((t) => t.type !== 'default')
    if (value) transforms = [...transforms, { type: 'default', default_value: value }]
    updateMapping(index, { transforms })
  }

  // Kaç transform var (cast + default hariç) — genişleme rozeti için
  const extraTransformCount = (mapping: ColumnMapping) =>
    (mapping.transforms || []).filter((t) => t.type !== 'cast' && t.type !== 'default').length

  const hasSelected = selectedRows.size > 0

  // Yükleniyor durumu
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Kaynak kolonlar yükleniyor...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Kolon Eşleme</span>
          {mappings.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {mappings.filter((m) => !m.skip).length} / {mappings.length} aktif
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasSelected && (
            <>
              <button
                onClick={() => skipSelected(true)}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
              >
                Seçiliyi Atla
              </button>
              <button
                onClick={() => skipSelected(false)}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
              >
                Seçiliyi Dahil Et
              </button>
              <button
                onClick={deleteSelected}
                className="text-xs text-destructive hover:text-destructive/80 border border-destructive/30 rounded px-2 py-0.5"
              >
                Seçiliyi Sil ({selectedRows.size})
              </button>
              <div className="w-px h-4 bg-border" />
            </>
          )}
          {sourceColumns.length > 0 && (
            <button
              onClick={onAutoMap ?? autoMap}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Wand2 className="h-3 w-3" />
              Otomatik Eşle
            </button>
          )}
          <button
            onClick={addMapping}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            Satır Ekle
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[20px_1fr_auto_1fr_96px_80px_auto_auto] items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
        <input
          type="checkbox"
          checked={allSelected && mappings.length > 0}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="rounded"
          title="Tümünü seç"
        />
        <span>Kaynak Kolon</span>
        <span />
        <span>Hedef Kolon</span>
        <span>Cast</span>
        <span>Varsayılan</span>
        <span>Atla</span>
        <span />
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {mappings.map((mapping, index) => {
          const isSkipped = mapping.skip || false
          const isExpanded = expandedRows.has(index)
          const isRowSelected = selectedRows.has(index)
          const castType = getCastType(mapping)
          const defaultVal = getDefaultValue(mapping)
          const extraCount = extraTransformCount(mapping)

          // Kaynak kolon tipi: önce canlı sourceColumns'dan, sonra mapping'e kaydedilmiş source_type'dan,
          // son olarak kaynak kolon adıyla eşleşen hedef kolon tipinden (aynı yapıdaki tablo→tablo aktarımları için)
          const srcCol = sourceColumns.find((sc) => sc.name === mapping.source_column)
          const srcType = srcCol?.type || mapping.source_type || getDstType(mapping.source_column) || ''

          // Hedef kolon tipi: önce canlı dstColumns'dan, bulamazsa mapping'e kaydedilmiş target_type'dan
          const dstType = getDstType(mapping.target_column) || mapping.target_type || ''

          return (
            <div
              key={index}
              className={`rounded-lg border transition-colors ${
                isSkipped
                  ? 'border-border bg-muted/30 opacity-60'
                  : isRowSelected
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              {/* Ana satır */}
              <div className="grid grid-cols-[20px_1fr_auto_1fr_96px_80px_auto_auto] items-start gap-1.5 p-2">
                {/* Seç */}
                <input
                  type="checkbox"
                  checked={isRowSelected}
                  onChange={(e) => handleRowSelect(index, e.target.checked)}
                  className="rounded mt-1.5"
                />

                {/* Kaynak Kolon + tip badge */}
                <div className="flex flex-col min-w-0">
                  <select
                    value={mapping.source_column}
                    onChange={(e) => updateMapping(index, { source_column: e.target.value })}
                    disabled={isSkipped}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="">-- Seç --</option>
                    {sourceColumns.map((sc) => (
                      <option key={sc.name} value={sc.name}>{sc.name}</option>
                    ))}
                    {mapping.source_column &&
                      !sourceColumns.some((sc) => sc.name === mapping.source_column) && (
                        <option value={mapping.source_column}>{mapping.source_column} ⚠️</option>
                      )}
                  </select>
                  <TypeBadge type={srcType} />
                </div>

                {/* Ok */}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-1.5" />

                {/* Hedef Kolon + tip badge */}
                <div className="flex flex-col min-w-0">
                  <input
                    type="text"
                    value={mapping.target_column}
                    onChange={(e) => updateMapping(index, { target_column: e.target.value })}
                    disabled={isSkipped}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
                    placeholder="Hedef kolon adı"
                  />
                  <TypeBadge type={dstType} />
                </div>

                {/* Cast / Tip Dönüşümü */}
                <div className="flex flex-col">
                  <select
                    value={castType}
                    onChange={(e) => updateCastType(index, e.target.value as DataType | '')}
                    disabled={isSkipped}
                    className={`w-full rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                      castType
                        ? 'border-amber-600/50 bg-amber-950/20 text-amber-300'
                        : 'border-border bg-background'
                    }`}
                    title="Kaynak veriyi bu tipe dönüştür"
                  >
                    <option value="">— Cast —</option>
                    {DATA_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                  {/* Cast seçiliyse ok göster */}
                  {castType && (
                    <span className="text-[10px] text-amber-400 mt-0.5 truncate">
                      → {DATA_TYPES.find((d) => d.value === castType)?.label}
                    </span>
                  )}
                </div>

                {/* Varsayılan Değer */}
                <input
                  type="text"
                  value={defaultVal}
                  onChange={(e) => updateDefaultValue(index, e.target.value)}
                  disabled={isSkipped}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50 mt-0"
                  placeholder="NULL →"
                  title="NULL gelirse kullanılacak değer"
                />

                {/* Atla */}
                <div className="flex justify-center mt-1.5">
                  <input
                    type="checkbox"
                    checked={isSkipped}
                    onChange={(e) => updateMapping(index, { skip: e.target.checked })}
                    className="rounded"
                    title="Bu kolonu akışa dahil etme"
                  />
                </div>

                {/* Sağ butonlar */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  <button
                    onClick={() => toggleExpand(index)}
                    className={`rounded p-0.5 hover:bg-accent transition-colors relative ${
                      extraCount > 0 ? 'text-primary' : 'text-muted-foreground'
                    }`}
                    title={extraCount > 0 ? `${extraCount} ek dönüşüm` : 'Ek dönüşümler'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    {extraCount > 0 && !isExpanded && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center font-bold">
                        {extraCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => removeMapping(index)}
                    className="rounded p-0.5 hover:bg-destructive/10 text-destructive transition-colors"
                    title="Satırı sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Genişletilmiş dönüşüm paneli */}
              {isExpanded && (
                <div className="border-t border-border px-3 pb-3 pt-2 bg-background/50 rounded-b-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    Ek dönüşümler — <span className="font-mono text-foreground">{mapping.source_column}</span>
                    {srcType && <span className="ml-1 text-[10px]"><TypeBadge type={srcType} /></span>}
                    {' '}→{' '}
                    <span className="font-mono text-foreground">{mapping.target_column || '?'}</span>
                    {dstType && <span className="ml-1 text-[10px]"><TypeBadge type={dstType} /></span>}
                  </p>
                  <TransformEditor
                    transforms={(mapping.transforms || []).filter(
                      (t) => t.type !== 'cast' && t.type !== 'default'
                    )}
                    onChange={(newTransforms) => {
                      const kept = (mapping.transforms || []).filter(
                        (t) => t.type === 'cast' || t.type === 'default'
                      )
                      updateMapping(index, { transforms: [...kept, ...newTransforms] })
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Boş durum */}
      {mappings.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Henüz kolon eşlemesi yok.</p>
          {sourceColumns.length > 0 ? (
            <button
              onClick={onAutoMap ?? autoMap}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Wand2 className="h-4 w-4" />
              Otomatik Eşle ({sourceColumns.length} kolon)
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Kaynak node bağlantı bilgilerini doldurun, kolonlar otomatik yüklenecek.
            </p>
          )}
        </div>
      )}

      {/* Toplu tip dönüşümü — sadece seçili satır varsa */}
      {hasSelected && (
        <div className="flex items-center gap-2 pt-1 border-t border-border flex-wrap">
          <span className="text-xs text-muted-foreground">Seçilenlere toplu cast:</span>
          <div className="flex gap-1 flex-wrap">
            {DATA_TYPES.map((dt) => (
              <button
                key={dt.value}
                onClick={() => castSelected(dt.value)}
                className="text-xs rounded border border-border bg-background px-2 py-0.5 hover:bg-accent transition-colors"
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
