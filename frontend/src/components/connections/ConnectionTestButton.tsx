import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { ConnectionTestResult } from '@/types/connection'

interface Props {
  onTest: () => void
  isLoading: boolean
  result: ConnectionTestResult | null
}

export default function ConnectionTestButton({ onTest, isLoading, result }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onTest}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Test ediliyor...
          </>
        ) : (
          'Bağlantıyı Test Et'
        )}
      </button>

      {result && !isLoading && (
        <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-success' : 'text-destructive'}`}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  )
}
