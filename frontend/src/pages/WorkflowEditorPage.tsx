import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useWorkflow } from '@/hooks/useWorkflows'
import WorkflowEditor from '@/components/workflow-editor/WorkflowEditor'

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { data: workflow, isLoading } = useWorkflow(id!)

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Workflow bulunamadı</p>
      </div>
    )
  }

  return <WorkflowEditor workflow={workflow} />
}
