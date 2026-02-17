import { Key, Hash } from 'lucide-react'
import type { ColumnInfo } from '@/types/connection'

interface Props {
  columns: ColumnInfo[]
}

export default function ColumnList({ columns }: Props) {
  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Kolon bulunamadı
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {columns.map((col) => (
        <div
          key={col.name}
          className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            {col.is_primary_key ? (
              <Key className="h-3.5 w-3.5 text-yellow-400" />
            ) : (
              <Hash className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
            <span className="text-sm font-medium">{col.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{col.data_type}</span>
            {col.nullable && (
              <span className="text-xs text-muted-foreground/50">nullable</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
