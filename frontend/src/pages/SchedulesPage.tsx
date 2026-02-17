import { Clock, Plus } from 'lucide-react'

export default function SchedulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Zamanlamalar</h1>
          <p className="text-muted-foreground mt-1">Periyodik workflow çalıştırma zamanlamaları</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Yeni Zamanlama
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Zamanlama bulunamadı</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Bir workflow için periyodik zamanlama ekleyerek otomatik çalıştırma kurabilirsiniz.
        </p>
      </div>
    </div>
  )
}
