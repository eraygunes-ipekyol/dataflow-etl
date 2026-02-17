import { useState } from 'react'
import { ChevronRight, ChevronDown, Table2, Loader2 } from 'lucide-react'
import { useSchemas, useTables } from '@/hooks/useConnections'
import type { TableInfo } from '@/types/connection'

interface Props {
  connectionId: string
  onTableSelect?: (schema: string, table: string) => void
}

export default function SchemaViewer({ connectionId, onTableSelect }: Props) {
  const { data: schemas, isLoading: schemasLoading } = useSchemas(connectionId)
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null)

  if (schemasLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {schemas?.map((schema) => (
        <SchemaNode
          key={schema.name}
          connectionId={connectionId}
          schemaName={schema.name}
          expanded={expandedSchema === schema.name}
          onToggle={() =>
            setExpandedSchema(expandedSchema === schema.name ? null : schema.name)
          }
          onTableSelect={onTableSelect}
        />
      ))}
    </div>
  )
}

function SchemaNode({
  connectionId,
  schemaName,
  expanded,
  onToggle,
  onTableSelect,
}: {
  connectionId: string
  schemaName: string
  expanded: boolean
  onToggle: () => void
  onTableSelect?: (schema: string, table: string) => void
}) {
  const { data: tables, isLoading } = useTables(
    connectionId,
    expanded ? schemaName : '',
  )

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="font-medium">{schemaName}</span>
      </button>

      {expanded && (
        <div className="ml-4 space-y-0.5">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Yükleniyor...
            </div>
          ) : (
            tables?.map((table: TableInfo) => (
              <button
                key={table.name}
                onClick={() => onTableSelect?.(schemaName, table.name)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Table2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span>{table.name}</span>
                </div>
                {table.row_count != null && (
                  <span className="text-xs text-muted-foreground">
                    {table.row_count.toLocaleString('tr-TR')} satır
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
