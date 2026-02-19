import { Play, Loader2 } from 'lucide-react'
import { useRunWorkflow } from '@/hooks/useExecutions'

interface Props {
  workflowId: string
  onStarted?: (executionId: string) => void
}

export default function RunButton({ workflowId, onStarted }: Props) {
  const runWorkflow = useRunWorkflow()

  const handleRun = async () => {
    const execution = await runWorkflow.mutateAsync(workflowId)
    onStarted?.(execution.id)
  }

  return (
    <button
      onClick={handleRun}
      disabled={runWorkflow.isPending}
      className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
    >
      {runWorkflow.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      {runWorkflow.isPending ? 'Başlatılıyor...' : 'Çalıştır'}
    </button>
  )
}
