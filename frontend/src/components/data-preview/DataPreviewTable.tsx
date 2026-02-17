import type { ColumnInfo } from '@/types/connection'

interface Props {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  totalRows: number
  truncated: boolean
}

export default function DataPreviewTable({ columns, rows, totalRows, truncated }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Veri bulunamadı</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Info bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalRows} satır {truncated && '(sınırlandırılmış)'}
        </span>
        <span>{columns.length} kolon</span>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground">{col.name}</span>
                    <span className="font-normal text-muted-foreground/70">
                      {col.data_type}
                      {col.is_primary_key && ' (PK)'}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.name} className="whitespace-nowrap px-4 py-2 text-sm">
                    {formatCellValue(row[col.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
