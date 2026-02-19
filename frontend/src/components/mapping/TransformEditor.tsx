import { Plus, Trash2 } from 'lucide-react'
import type { ColumnTransform, DataType, TransformType } from '@/types/workflow'

const TRANSFORM_TYPES: { value: TransformType; label: string }[] = [
  { value: 'rename', label: 'Yeniden Adlandır' },
  { value: 'cast', label: 'Tip Dönüşümü' },
  { value: 'default', label: 'Varsayılan Değer' },
  { value: 'expression', label: 'İfade' },
  { value: 'drop', label: 'Kaldır' },
]

const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: 'string', label: 'Metin' },
  { value: 'integer', label: 'Tam Sayı' },
  { value: 'float', label: 'Ondalık' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Tarih' },
  { value: 'datetime', label: 'Tarih & Saat' },
  { value: 'timestamp', label: 'Timestamp' },
]

interface Props {
  transforms: ColumnTransform[]
  onChange: (transforms: ColumnTransform[]) => void
}

export default function TransformEditor({ transforms, onChange }: Props) {
  const addTransform = () => {
    onChange([...transforms, { type: 'rename' }])
  }

  const updateTransform = (index: number, update: Partial<ColumnTransform>) => {
    const next = transforms.map((t, i) => (i === index ? { ...t, ...update } : t))
    onChange(next)
  }

  const removeTransform = (index: number) => {
    onChange(transforms.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {transforms.map((transform, index) => (
        <div key={index} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
          <select
            value={transform.type}
            onChange={(e) => updateTransform(index, { type: e.target.value as TransformType })}
            className="rounded border border-border bg-card px-2 py-1 text-xs"
          >
            {TRANSFORM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {transform.type === 'rename' && (
            <input
              type="text"
              placeholder="Yeni isim"
              value={transform.target_name || ''}
              onChange={(e) => updateTransform(index, { target_name: e.target.value })}
              className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs"
            />
          )}

          {transform.type === 'cast' && (
            <select
              value={transform.cast_to || 'string'}
              onChange={(e) => updateTransform(index, { cast_to: e.target.value as DataType })}
              className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs"
            >
              {DATA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          )}

          {transform.type === 'default' && (
            <input
              type="text"
              placeholder="Varsayılan değer"
              value={transform.default_value || ''}
              onChange={(e) => updateTransform(index, { default_value: e.target.value })}
              className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs"
            />
          )}

          {transform.type === 'expression' && (
            <input
              type="text"
              placeholder="İfade (örn: 'sabit_deger' veya 42)"
              value={transform.expression || ''}
              onChange={(e) => updateTransform(index, { expression: e.target.value })}
              className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs"
            />
          )}

          {transform.type === 'drop' && (
            <span className="flex-1 text-xs text-muted-foreground py-1">Bu kolon çıktıya dahil edilmez</span>
          )}

          <button
            onClick={() => removeTransform(index)}
            className="rounded p-1 hover:bg-destructive/10 text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addTransform}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" />
        Dönüşüm ekle
      </button>
    </div>
  )
}
