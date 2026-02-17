import { GitBranch, Plus } from 'lucide-react'

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflowlar</h1>
          <p className="text-muted-foreground mt-1">ETL akışlarını tasarlayın ve yönetin</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Yeni Workflow
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Workflow bulunamadı</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Yeni bir workflow oluşturarak veri akışınızı tasarlayın.
        </p>
      </div>
    </div>
  )
}
