import { useMutation } from '@tanstack/react-query'
import { previewTable, previewQuery } from '@/api/connections'
import type { PreviewTableRequest, PreviewQueryRequest } from '@/types/dataPreview'

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
