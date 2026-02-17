import { Activity, Database, GitBranch, Clock } from 'lucide-react'

const stats = [
  { label: 'Bağlantılar', value: '0', icon: Database, color: 'text-blue-400' },
  { label: 'Workflowlar', value: '0', icon: GitBranch, color: 'text-green-400' },
  { label: 'Çalıştırmalar', value: '0', icon: Activity, color: 'text-yellow-400' },
  { label: 'Zamanlamalar', value: '0', icon: Clock, color: 'text-purple-400' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">DataFlow ETL genel bakış</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Son Çalıştırmalar</h2>
        <p className="text-muted-foreground text-sm">
          Henüz çalıştırma yok. Bir workflow oluşturup çalıştırarak başlayın.
        </p>
      </div>
    </div>
  )
}
