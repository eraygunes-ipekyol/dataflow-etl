import { Activity } from 'lucide-react'

export default function ExecutionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Çalıştırmalar</h1>
        <p className="text-muted-foreground mt-1">Workflow çalıştırma geçmişi</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Çalıştırma bulunamadı</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Bir workflow çalıştırıldığında geçmiş burada görüntülenir.
        </p>
      </div>
    </div>
  )
}
