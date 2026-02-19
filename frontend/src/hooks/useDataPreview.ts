import { useMutation } from '@tanstack/react-query'
import { previewTable, previewQuery, getQueryColumns } from '@/api/connections'
import type { PreviewTableRequest, PreviewQueryRequest } from '@/types/dataPreview'
import type { ColumnInfo } from '@/types/connection'

export function usePreviewTable() {
  return useMutation({
    mutationFn: (data: PreviewTableRequest) => previewTable(data),
  })
}

export function usePreviewQuery() {
  return useMutation({
    mutationFn: (data: PreviewQueryRequest) => previewQuery(data),
  })
}

/** SQL sorgusunun kolon listesini çeker — mapping için */
export function useQueryColumns() {
  return useMutation<ColumnInfo[], Error, { connection_id: string; query: string }>({
    mutationFn: ({ connection_id, query }) => getQueryColumns(connection_id, query),
  })
}
